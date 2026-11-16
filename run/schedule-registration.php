<?php
declare(strict_types=1);

/**
 * Resolve registrations to ONE official program row. Imported event fixtures
 * may repeat an event name for heat 1/2 and retain historical team totals;
 * registrations are the source of truth for the current year's entrants.
 *
 * Unassigned (NULL/0) registration heats are linked to their original event
 * row. An explicitly assigned heat takes priority over the original event ID.
 * This prevents the same entrants appearing in every heat.
 */
function bang1_schedule_name(string $value): string {
    return trim((string)(preg_replace('/\s+/u', ' ', str_replace("\xC2\xA0", ' ', $value)) ?? $value));
}
function bang1_schedule_same_optional_field(mixed $a, mixed $b): bool {
    $left=bang1_schedule_name((string)($a??''));
    $right=bang1_schedule_name((string)($b??''));
    return $left==='' || $right==='' || $left===$right;
}
function bang1_schedule_is_final(array $event): bool {
    return trim((string)($event['HeatPlan']??''))==='ชิง'
        || (trim((string)($event['Remark']??''))==='คัดเลือก'
            && trim((string)($event['Stage']??''))==='ชิงชนะเลิศ');
}
function bang1_schedule_resolve(array $events, array $registrations): array {
    $map=[];
    foreach($events as $event){
        $key=(string)($event['EventID']??'');
        if($key==='')continue;
        $map[$key]=['entries'=>[], 'RegisteredTeams'=>0];
    }
    foreach($registrations as $reg){
        $regId=(int)($reg['event_id']??0);
        $regName=bang1_schedule_name((string)($reg['event_name']??''));
        $assignedHeat=(int)($reg['heat']??0);
        $chosen=null;
        $best=-1000000;
        foreach($events as $event){
            $id=(int)($event['EventID']??0);
            if($id<=0)continue;
            $direct=$regId>0 && $regId===$id;
            $eventName=bang1_schedule_name((string)($event['EventName']??''));
            $sameName=$regName!=='' && $regName===$eventName;
            $compatible=bang1_schedule_same_optional_field($reg['category']??'', $event['Category']??'')
                && bang1_schedule_same_optional_field($reg['level']??'', $event['Level']??'');
            if(!$compatible || (!$direct && !$sameName))continue;

            $rowHeat=(int)($event['Heat']??0);
            // Assigned heat is strongest; exact source event is second.
            $score=$direct?200:0;
            $score+=bang1_schedule_is_final($event)?0:100;
            if($assignedHeat>0) {
                $score+=$rowHeat===$assignedHeat?2000:($rowHeat===0?0:-400);
            } else {
                $score+=$rowHeat===1?60:($rowHeat===0?30:0);
            }
            if($score>$best){
                $best=$score;
                $chosen=(string)$id;
            }
        }
        if($chosen===null)continue; // Never synthesize entrants for unrelated races.
        $map[$chosen]['entries'][]=[
            'SchoolName'=>(string)($reg['school_name']??''),
            'RunnerName'=>(string)($reg['runner_names']??''),
            'Heat'=>$assignedHeat>0?$assignedHeat:null,
            'Lane'=>$reg['lane']??null
        ];
    }
    foreach($map as &$item){
        $schools=[];
        foreach($item['entries'] as $entry){
            $name=trim($entry['SchoolName']);
            if($name!=='')$schools[$name]=true;
        }
        $item['RegisteredTeams']=count($schools);
        usort($item['entries'],static function(array $a,array $b):int {
            $la=(int)($a['Lane']??0);
            $lb=(int)($b['Lane']??0);
            return ($la>0?$la:9999)<=>($lb>0?$lb:9999);
        });
    }
    unset($item);
    return $map;
}


/**
 * The schedule preview is READ-ONLY. Only auto_heats may persist randomized
 * heats/lanes; until then registrations are laid out in signup order.
 */
function bang1_schedule_preview_key(string $name,string $category,string $level): string {
    return implode("\x1f",[
        bang1_schedule_name($name),
        bang1_schedule_name($category),
        bang1_schedule_name($level)
    ]);
}
function bang1_schedule_preview(array $fixtures,array $registrations):array {
    usort($registrations,static function(array $a,array $b):int{
        $aTime=trim((string)($a['created_at']??''))?:'9999-12-31 23:59:59';
        $bTime=trim((string)($b['created_at']??''))?:'9999-12-31 23:59:59';
        return strcmp($aTime,$bTime) ?: ((int)$a['id']<=>(int)$b['id']);
    });
    $groups=[];$allSchools=[];
    foreach($registrations as $reg){
        $school=bang1_schedule_name((string)($reg['school_name']??''));
        if($school==='')continue;
        $key=bang1_schedule_preview_key(
            (string)($reg['event_name']??''),(string)($reg['category']??''),(string)($reg['level']??''));
        if(!isset($groups[$key])){
            $groups[$key]=[
                'registrations'=>[], 'schools'=>[],
                'firstAt'=>(string)($reg['created_at']??''),
                'firstId'=>(int)($reg['id']??0)
            ];
        }
        $groups[$key]['registrations'][]=$reg;
        if(!isset($groups[$key]['schools'][$school]))
            $groups[$key]['schools'][$school]=$reg;
        $allSchools[$school]=true;
    }
    $indices=[];
    foreach($fixtures as $i=>&$row){
        $key=bang1_schedule_preview_key(
            (string)($row['EventName']??''),(string)($row['Category']??''),(string)($row['Level']??''));
        $indices[$key][]=$i;
        $group=$groups[$key]??null;
        $row['GroupKey']=$key;
        $row['RegistrationCount']=count($group['registrations']??[]);
        $row['FirstRegistrationAt']=(string)($group['firstAt']??'');
        $row['FirstRegistrationId']=(int)($group['firstId']??0);
        $row['SlotStatus']='not_drawn';
        $row['entries']=is_array($row['entries']??null)?$row['entries']:[];
    }
    unset($row);
    $pending=0;
    foreach($groups as $key=>$group){
        $raceRows=[];
        foreach($indices[$key]??[] as $rowId){
            $round=(string)($fixtures[$rowId]['CompetitionRound']??'');
            if($round==='คัดเลือก'||$round==='ชิงชนะเลิศทันที')
                $raceRows[]=$rowId;
            elseif($round==='รอผลการแข่งขันรอบคัดเลือก'){
                $fixtures[$rowId]['entries']=[];
                $fixtures[$rowId]['RegisteredTeams']=0;
                $fixtures[$rowId]['SlotStatus']='waiting';
            }
        }
        if(!$raceRows)continue;
        $schools=array_values($group['schools']);
        $assigned=[];$seen=[];$drawn=true;
        foreach($schools as $school){
            $h=(int)($school['heat']??0);
            $lane=(int)($school['lane']??0);
            if($h<1||$h>count($raceRows)||$lane<1||$lane>8||isset($seen[$h][$lane])){
                $drawn=false;break;
            }
            $seen[$h][$lane]=true;
            $assigned[$h][]=$school;
        }
        if($drawn){
            foreach($raceRows as $i=>$rowId){
                if(count($assigned[$i+1]??[])!==(int)($fixtures[$rowId]['TeamCount']??0)){
                    $drawn=false;break;
                }
            }
        }
        if(!$drawn)$pending++;
        $offset=0;
        foreach($raceRows as $i=>$rowId){
            $heat=$i+1;
            $size=(int)($fixtures[$rowId]['TeamCount']??0);
            $members=$drawn?($assigned[$heat]??[]):array_slice($schools,$offset,$size);
            $offset+=$size;
            $lanes=$drawn?[]:event_lanes(count($members));
            $entries=[];
            foreach($members as $j=>$reg){
                $entries[]=[
                    'SchoolName'=>(string)$reg['school_name'],
                    'RunnerName'=>(string)($reg['runner_names']??''),
                    'Heat'=>$heat,
                    'Lane'=>$drawn?(int)$reg['lane']:$lanes[$j],
                    'IsProvisional'=>!$drawn
                ];
            }
            usort($entries,static fn(array $a,array $b):int=>
                (int)$a['Lane']<=>(int)$b['Lane']);
            $fixtures[$rowId]['entries']=$entries;
            $fixtures[$rowId]['RegisteredTeams']=count($entries);
            $fixtures[$rowId]['SlotStatus']=$drawn?'drawn':'preview';
        }
    }
    // Older first registration gets priority. Same race stays together
    // (heats in numeric order, reserved final after preliminary heats).
    usort($fixtures,static function(array $a,array $b):int {
        $aHas=(int)($a['RegistrationCount']??0)>0;
        $bHas=(int)($b['RegistrationCount']??0)>0;
        if($aHas!==$bHas)return $aHas?-1:1;
        if($aHas){
            $aTime=trim((string)($a['FirstRegistrationAt']??''))?:'9999-12-31 23:59:59';
            $bTime=trim((string)($b['FirstRegistrationAt']??''))?:'9999-12-31 23:59:59';
            $dateCmp=strcmp($aTime,$bTime);
            if($dateCmp!==0)return $dateCmp;
            $idCmp=(int)($a['FirstRegistrationId']??0) <=>
                (int)($b['FirstRegistrationId']??0);
            if($idCmp!==0)return $idCmp;
            if(($a['GroupKey']??'')===($b['GroupKey']??'')){
                $finalA=($a['SlotStatus']??'')==='waiting';
                $finalB=($b['SlotStatus']??'')==='waiting';
                if($finalA!==$finalB)return $finalA?1:-1;
                return (int)($a['Heat']??0)<=>(int)($b['Heat']??0);
            }
        }
        return (int)($a['SourceOrder']??$a['EventID']??0)
            <=>(int)($b['SourceOrder']??$b['EventID']??0);
    });
    return [
        'rows'=>$fixtures,
        'summary'=>[
            'registrationCount'=>count($registrations),
            'competitionCount'=>count($groups),
            'schoolCount'=>count($allSchools),
            'previewCompetitionCount'=>$pending
        ]
    ];
}
