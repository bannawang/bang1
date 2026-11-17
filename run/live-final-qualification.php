<?php
declare(strict_types=1);

/**
 * Derive finalists for LIVE from the official, completed qualifying result.
 * These are read-only copies of existing registration rows. Do not copy
 * preliminary check-ins or write changes to runners, uploads or registrations.
 */
function bang1_live_final_registration_rows(array $schedule,array $sourceRegistrations):array {
    $byId=[];
    foreach($sourceRegistrations as $reg){
        $id=(int)($reg['id']??0);
        if($id>0)$byId[$id]=$reg;
    }
    $out=[];
    foreach($schedule as $fixture){
        if(($fixture['CompetitionRound']??'')!=='ชิงชนะเลิศ'
            ||($fixture['HeatPlan']??'')!=='ชิง'
            ||!empty($fixture['QualificationPending']))continue;
        $entries=$fixture['entries']??[];
        if(!is_array($entries)||count($entries)!==6)continue;
        $eventId=(int)($fixture['EventID']??0);
        if($eventId<=0)continue;
        $batch=[];$lanes=[];$schools=[];
        foreach($entries as $entry){
            $registrationId=(int)($entry['RegistrationID']??0);
            $lane=(int)($entry['Lane']??0);
            $source=$byId[$registrationId]??null;
            $school=trim((string)($entry['SchoolName']??''));
            if(!$source||$lane<2||$lane>7||isset($lanes[$lane])
                ||$school===''||isset($schools[$school])
                ||trim((string)$source['school_name'])!==$school
                ||trim((string)$source['event_name'])!==trim((string)($fixture['EventName']??''))
                ||trim((string)($source['category']??''))!==trim((string)($fixture['Category']??''))
                ||trim((string)($source['level']??''))!==trim((string)($fixture['Level']??''))){
                $batch=[];break;
            }
            $lanes[$lane]=true;$schools[$school]=true;
            $virtual=$source;
            // A final uses ONLY runners checked in during the qualifier.
            // An explicitly empty selection stays empty, never all reserves.
            if(array_key_exists('RunnerIDs',$entry))
                $virtual['runner_ids']=(string)$entry['RunnerIDs'];
            if(array_key_exists('RunnerName',$entry))
                $virtual['runner_names']=(string)$entry['RunnerName'];
            if(array_key_exists('Photos',$entry))
                $virtual['photos']=(string)$entry['Photos'];
            $virtual['heat']=1;
            $virtual['lane']=$lane;
            $virtual['_qualified_final']=true;
            $virtual['_final_event_id']=$eventId;
            $virtual['_final_order']=(int)($fixture['SourceOrder']??$eventId);
            $batch[]=$virtual;
        }
        if(count($batch)!==6)continue;
        foreach($batch as $row)$out[]=$row;
    }
    return $out;
}
