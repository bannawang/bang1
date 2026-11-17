<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/run/final-qualification.php';
function final_assert(bool $ok,string $message):void {
    if(!$ok)throw new RuntimeException($message);
}
$registrations=[];
foreach([1,2] as $heat){
    for($rank=1;$rank<=4;$rank++){
        $school="School-H{$heat}-{$rank}";
        $registrations[]=['id'=>($heat*100+$rank),'heat'=>$heat,'school_name'=>$school,
            'runner_ids'=>(string)($heat*100+$rank),'runner_names'=>"Runner {$school}",
            'photos'=>"https://example.test/{$school}.png"];
    }
}
$results=[
    1=>['1'=>'School-H1-1','2'=>'School-H1-2','3'=>'School-H1-3'],
    2=>['1'=>'School-H2-1','2'=>'School-H2-2','3'=>'School-H2-3']
];
$copy=$registrations;
$out=bang1_qualifying_final_entries($registrations,$results);
final_assert($registrations===$copy,'Original registrations mutated');
final_assert(count($out)===6,'Six finalists expected');
$expected=[2=>['School-H1-3',1,3],3=>['School-H1-2',1,2],
    4=>['School-H1-1',1,1],5=>['School-H2-1',2,1],
    6=>['School-H2-2',2,2],7=>['School-H2-3',2,3]];
foreach($out as $entry){
    $lane=$entry['Lane'];
    final_assert(isset($expected[$lane]),"Unexpected lane {$lane}");
    final_assert([$entry['SchoolName'],$entry['QualifyingHeat'],$entry['QualifyingRank']]===$expected[$lane],
        "Incorrect position at lane {$lane}");
    final_assert($entry['RunnerName']!=='' && $entry['RegistrationID']>0,'Lost runner/registration reference');
}
final_assert(bang1_qualifying_final_entries($registrations,[1=>$results[1]])===[],
    'Incomplete heat results must remain pending');
$invalid=$results;
$invalid[2]['3']='School-H1-4';
final_assert(bang1_qualifying_final_entries($registrations,$invalid)===[],
    'Unqualified school from another heat');
$invalid=$registrations;$invalid[0]['heat']=0;
final_assert(bang1_qualifying_final_entries($invalid,$results)===[],
    'Undrawn registrations must remain pending');
$invalid=$registrations;$invalid[0]['heat']=3;
final_assert(bang1_qualifying_final_entries($invalid,$results)===[],
    'Three or more preliminary heats must not overflow the final');
echo "PASS: top three per heat, lanes 2-7, no data mutation, pending checks\n";
