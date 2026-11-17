<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/run/live-final-qualification.php';
require dirname(__DIR__,2).'/run/schedule-registration.php';
function final_live_assert(bool $ok,string $message):void {
    if(!$ok)throw new RuntimeException($message);
}
function event_lanes(int $count):array {return range(1,$count);}
$regs=[];
foreach([2,3,4,5,6,7] as $lane){
    $regs[]=['id'=>$lane,'event_name'=>'วิ่ง 60 เมตร (6 ปี ชาย)',
        'category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','school_name'=>'School '.$lane,
        'runner_ids'=>(string)($lane+100),'runner_names'=>'Athlete '.$lane,
        'photos'=>'https://example.test/photo'.$lane,
        'heat'=>$lane<=4?1:2,'lane'=>$lane<=4?$lane-1:$lane-4,
        'created_at'=>'2026-11-17 08:00:00'];
}
$final=[
    'EventID'=>31,'EventName'=>'วิ่ง 60 เมตร (6 ปี ชาย)',
    'Category'=>'วิ่งเดี่ยว','Level'=>'อนุบาล','SourceOrder'=>31,
    'Stage'=>'ชิงชนะเลิศ','Remark'=>'คัดเลือก','HeatPlan'=>'ชิง','Heat'=>'ชิง',
    'TeamCount'=>null,'CompetitionRound'=>'ชิงชนะเลิศ',
    'QualificationPending'=>false,'QualificationSavedHeats'=>2,
    'QualificationRequiredHeats'=>2,
    'entries'=>array_map(static fn($r)=>['SchoolName'=>$r['school_name'],
       'RunnerName'=>$r['runner_names'],'RegistrationID'=>$r['id'],
       'Lane'=>$r['id'],'Heat'=>1],$regs)
];
$unchanged=$regs;
$out=bang1_live_final_registration_rows([$final],$regs);
final_live_assert($regs===$unchanged,'Live changed registration data');
final_live_assert(count($out)===6,'Six finalists must appear on LIVE');
foreach($out as $item){
    final_live_assert($item['_qualified_final']===true
       &&$item['_final_event_id']===31,'Final fixture identity lost');
    final_live_assert($item['lane']===$item['id'],'Final lanes 2..7 lost');
    final_live_assert($item['runner_ids']!=='' &&$item['photos']!=='',
       'Final lost runner IDs/photos');
}
$final['QualificationPending']=true;
final_live_assert(bang1_live_final_registration_rows([$final],$regs)===[],
    'Pending final must not show prematurely on LIVE');
$final['QualificationPending']=false;
$final['entries'][0]['SchoolName']='Another school';
final_live_assert(bang1_live_final_registration_rows([$final],$regs)===[],
    'Wrong school must not appear on LIVE');
$final['entries'][0]['SchoolName']='School 2';

$qual1=['EventID'=>29,'EventName'=>$final['EventName'],
    'Category'=>'วิ่งเดี่ยว','Level'=>'อนุบาล','Stage'=>'คัดเลือก',
    'SourceOrder'=>29,'Heat'=>1,'HeatPlan'=>1,'TeamCount'=>3,
    'CompetitionRound'=>'คัดเลือก'];
$qual2=array_merge($qual1,['EventID'=>30,'Heat'=>2,'HeatPlan'=>2,
    'SourceOrder'=>30]);
$preview=bang1_schedule_preview([$qual1,$qual2,$final],$regs);
$finalRow=null;
foreach($preview['rows'] as $row){
    if((int)$row['EventID']===31)$finalRow=$row;
}
final_live_assert($finalRow!==null,'Final fixture missing in schedule preview');
final_live_assert($finalRow['SlotStatus']==='final_ready',
    'Qualified final must not remain waiting');
final_live_assert(count($finalRow['entries'])===6,
    'Schedule preview discarded qualified finalists');
$final['CompetitionRound']='รอผลการแข่งขันรอบคัดเลือก';
$final['entries']=[];
$pending=bang1_schedule_preview([$qual1,$qual2,$final],$regs);
foreach($pending['rows'] as $row){
    if((int)$row['EventID']===31){
       final_live_assert($row['SlotStatus']==='waiting','Unfinished final displayed as ready');
       final_live_assert($row['entries']===[],'Unfinished final has a roster');
    }
}
echo "PASS finalized qualified roster in program and LIVE; pending rounds stay protected\n";
