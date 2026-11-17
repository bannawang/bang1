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
function bang1_qualifying_final_lane(int $heat, int $rank): ?int {
    $lanes=[1=>[1=>4,2=>3,3=>2],2=>[1=>5,2=>6,3=>7]];
    return $lanes[$heat][$rank]??null;
}

/**
 * @param array $registrations Current competition registrations with assigned preliminary heat
 * @param array $rankingsByHeat Saved official rankings keyed by preliminary heat (1 and 2)
 * @return array Six qualified entries in final lane order, or [] while incomplete/invalid
 */
function bang1_qualifying_final_entries(array $registrations,array $rankingsByHeat):array {
    $schoolsByHeat=[1=>[],2=>[]];
    foreach($registrations as $entry){
        $heat=(int)($entry['heat']??0);
        $school=trim((string)($entry['school_name']??''));
        // Finalists must come from existing registrations in one of two
        // assigned preliminary heats; provisional draws never qualify anyone.
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
            $finalists[]=[
                'SchoolName'=>$school,
                'RunnerName'=>(string)($entry['runner_names']??''),
                'RunnerIDs'=>(string)($entry['runner_ids']??''),
                'Photos'=>(string)($entry['photos']??''),
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
