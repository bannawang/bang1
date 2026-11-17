<?php
declare(strict_types=1);

/**
 * The two preliminary heats each advance places 1, 2 and 3.
 * Heat 1: first -> lane 4, second -> lane 3, third -> lane 2.
 * Heat 2: first -> lane 5, second -> lane 6, third -> lane 7.
 * Lanes 1 and 8 remain unused.
 *
 * Operate on copies of existing registration data; never add, delete or
 * mutate a registration, runner, photograph, document or preliminary result.
 */
/**
 * Build the final roster exclusively from preliminary check-ins.
 * No unchecked reserve may be promoted automatically. Checked runner
 * identity is resolved by stable runner ID or legacy slot index.
 */
function bang1_qualifying_confirmed_roster(array $entry,array $marks):array {
    $ids=array_map('trim',explode(',',(string)($entry['runner_ids']??'')));
    $names=array_map('trim',explode(',',(string)($entry['runner_names']??'')));
    $photos=array_map('trim',explode(',',(string)($entry['photos']??'')));
    $capacity=(str_contains((string)($entry['category']??''),'ผลัด')
        ||str_contains((string)($entry['event_name']??''),'ผลัด'))?4:1;
    $chosen=[];$seen=[];
    for($i=0,$count=max(count($ids),count($names));$i<$count;$i++){
        $id=$ids[$i]??'';
        $key=ctype_digit($id)&&(int)$id>0?'runner:'.(int)$id:'slot:'.($i+1);
        if(isset($seen[$key])||!array_key_exists($key,$marks))continue;
        $seen[$key]=true;
        $chosen[]=[
            'i'=>$i,'id'=>$id,'name'=>$names[$i]??'',
            'photo'=>$photos[$i]??'','at'=>(string)$marks[$key]
        ];
    }
    usort($chosen,static fn($a,$b)=>strcmp($a['at'],$b['at'])?:($a['i']<=>$b['i']));
    $chosen=array_slice($chosen,0,$capacity);
    usort($chosen,static fn($a,$b)=>$a['i']<=>$b['i']);
    return [
        'RunnerIDs'=>implode(',',array_column($chosen,'id')),
        'RunnerName'=>implode(',',array_column($chosen,'name')),
        'Photos'=>implode(',',array_column($chosen,'photo')),
        'ConfirmedAthletes'=>count($chosen),'RequiredAthletes'=>$capacity
    ];
}

function bang1_qualifying_final_lane(int $heat, int $rank): ?int {
    $lanes=[1=>[1=>4,2=>3,3=>2],2=>[1=>5,2=>6,3=>7]];
    return $lanes[$heat][$rank]??null;
}

/**
 * @param array $registrations Current competition registrations with assigned preliminary heat
 * @param array $rankingsByHeat Saved official rankings keyed by preliminary heat (1 and 2)
 * @return array Six qualified entries in final lane order, or [] while incomplete/invalid
 */
function bang1_qualifying_final_entries(array $registrations,array $rankingsByHeat,?array $checkedByRegistration=null):array {
    $schoolsByHeat=[1=>[],2=>[]];
    foreach($registrations as $entry){
        $heat=(int)($entry['heat']??0);
        $school=trim((string)($entry['school_name']??''));
        // Newly registered schools may still have heat=0 while the coaches
        // are entering athletes. They cannot qualify without a completed
        // preliminary heat, but must not erase previously saved top-three
        // results for OTHER schools that completed their heats.
        if($heat===0)continue;
        if(!in_array($heat,[1,2],true)||$school==='')return [];
        if(isset($schoolsByHeat[$heat][$school]))return [];
        $schoolsByHeat[$heat][$school]=$entry;
    }
    $finalists=[];$seen=[];
    foreach([1,2] as $heat){
        if(count($schoolsByHeat[$heat])<3)return [];
        $ranking=$rankingsByHeat[$heat]??null;
        if(!is_array($ranking))return [];
        for($rank=1;$rank<=3;$rank++){
            $school=trim((string)($ranking[(string)$rank]??$ranking[$rank]??''));
            if($school===''||!isset($schoolsByHeat[$heat][$school])||isset($seen[$school]))
                return [];
            $seen[$school]=true;
            $entry=$schoolsByHeat[$heat][$school];
            // Passing null preserves legacy callers; the production schedule
            // always passes the check-in map, including when it is empty.
            $locked=$checkedByRegistration===null?[
                'RunnerName'=>(string)($entry['runner_names']??''),
                'RunnerIDs'=>(string)($entry['runner_ids']??''),
                'Photos'=>(string)($entry['photos']??'')
            ]:bang1_qualifying_confirmed_roster($entry,
                $checkedByRegistration[(int)($entry['id']??0)]??[]);
            $finalists[]=[
                'SchoolName'=>$school,
                'RunnerName'=>$locked['RunnerName'],
                'RunnerIDs'=>$locked['RunnerIDs'],
                'Photos'=>$locked['Photos'],
                'ConfirmedAthletes'=>(int)($locked['ConfirmedAthletes']??0),
                'RequiredAthletes'=>(int)($locked['RequiredAthletes']??0),
                'RegistrationID'=>(int)($entry['id']??0),
                'Heat'=>1,
                'Lane'=>bang1_qualifying_final_lane($heat,$rank),
                'QualifyingHeat'=>$heat,
                'QualifyingRank'=>$rank
            ];
        }
    }
    usort($finalists,static fn(array $a,array $b):int=>$a['Lane']<=>$b['Lane']);
    return $finalists;
}
