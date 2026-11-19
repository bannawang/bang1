<?php
declare(strict_types=1);
// Production-style import: 15/16 and 17/18 already have printed heats/lanes.
// 37/38 are RESERVED finals with NULL heat and heat_plan, NOT extra heats.
// This test must never call auto_heats, UPDATE or DELETE.
$action='unit-test';
$fixtureEvents=[];
function eventRow(int $id,string $name,string $gender,string $heat,string $stage):array {
  return [
    'id'=>$id,'name'=>$name,'category'=>'วิ่งเดี่ยว',
    'level'=>'อนุบาล','gender'=>$gender,'remark'=>$stage,
    'heat'=>$heat?:null,'heat_plan'=>$heat?:null,'team_count'=>5,
    'total_teams'=>$gender==='ชาย'?9:10,'stage'=>$stage,
    'ranking_json'=>null,'source_order'=>$id
  ];
}
$male='วิ่ง 80 เมตร (6 ปี ชาย)';
$female='วิ่ง 80 เมตร (6 ปี หญิง)';
foreach([[15,$male,'ชาย','1','คัดเลือก'],
 [16,$male,'ชาย','2','คัดเลือก'],
 [17,$female,'หญิง','1','คัดเลือก'],
 [18,$female,'หญิง','2','คัดเลือก'],
 [37,$male,'ชาย','','ชิงชนะเลิศ'],
 [38,$female,'หญิง','','ชิงชนะเลิศ']] as $row){
  $fixtureEvents[]=eventRow(...$row);
}
$fixtureRegs=[];$fixtureCheckins=[];$fixtureResults=[];$before=[];
foreach([[37,$male,9],[38,$female,10]] as [$finalId,$name,$count]){
  for($i=1;$i<=$count;$i++){
    $heat=$i<=5?1:2;
    $lane=$heat===1?($i+1):($i-4);
    $id=$finalId*100+$i;
    $fixtureRegs[]=[
      'id'=>$id,'event_id'=>$finalId,'event_name'=>$name,
      'category'=>'วิ่งเดี่ยว','level'=>'อนุบาล',
      'school_name'=>'โรงเรียนทดสอบ '.$i,'runner_ids'=>(string)$id,
      'runner_names'=>'นักวิ่ง '.$i,'photos'=>'','heat'=>$heat,'lane'=>$lane,
      'created_at'=>'2026-11-19 08:00:00'
    ];
    $fixtureCheckins[]=[
      'registration_id'=>$id,'athlete_key'=>'runner:'.$id,
      'checked_at'=>'2026-11-19 09:00:00'
    ];
    $before[$id]=[$heat,$lane];
  }
}
function rows(string $sql,array $params=[]):array{
  global $fixtureEvents,$fixtureRegs,$fixtureCheckins,$fixtureResults;
  if(str_contains($sql,'FROM race_athlete_checkins'))return $fixtureCheckins;
  if(str_contains($sql,'FROM events'))return $fixtureEvents;
  if(str_contains($sql,'FROM registrations'))return $fixtureRegs;
  if(str_contains($sql,'FROM event_results')){
    if(str_contains($sql,"WHERE round_type='คัดเลือก'"))return $fixtureResults;
    return array_map(static fn($r)=>array_merge([
      'round_type'=>'คัดเลือก','staff_name'=>'Staff',
      'updated_at'=>'2026-11-19 09:30:00'
    ],$r),$fixtureResults);
  }
  throw new RuntimeException('Unexpected SQL: '.$sql);
}
require dirname(__DIR__,2).'/run/event-management.php';
require dirname(__DIR__,2).'/run/schedule-registration.php';
require dirname(__DIR__,2).'/run/staff-results.php';
function checkIt(bool $ok,string $reason):void{if(!$ok)throw new RuntimeException($reason);}
checkIt(event_is_final($fixtureEvents[4])&&event_is_final($fixtureEvents[5]),
  'Reserved final with empty heat_plan must be identified as a final');
checkIt(!event_is_final($fixtureEvents[0])&&!event_is_final($fixtureEvents[1]),
  'Printed preliminary heats must remain unchanged');

$schedule=event_schedule_data();
checkIt(array_column($schedule,'EventID')===[15,16,17,18,37,38],
  'Never lose final IDs 37 and 38 or duplicate printed prelims');
$byId=[];
foreach($schedule as $row)$byId[(int)$row['EventID']][]=$row;
foreach([[15,5],[16,4],[17,5],[18,5]] as [$id,$count]){
  checkIt(count($byId[$id]??[])===1 && count($byId[$id][0]['entries'])===$count,
    'Printed prelim event '.$id.' must preserve the original '.$count.' registrants');
  $heat=(int)($byId[$id][0]['Heat']??0);
  foreach($byId[$id][0]['entries'] as $entry){
    $source=array_values(array_filter($fixtureRegs,
      static fn($r)=>$r['school_name']===$entry['SchoolName']
        &&(int)$r['heat']===$heat
        &&$r['event_name']===$byId[$id][0]['EventName']));
    checkIt(count($source)===1 && $entry['Lane']===$source[0]['lane'],
      'Printed lane must never change in event '.$id);
  }
}
foreach([37,38] as $id){
  checkIt(count($byId[$id]??[])===1,'Keep one reserved final row '.$id);
  checkIt(($byId[$id][0]['CompetitionRound']??'')==='รอผลการแข่งขันรอบคัดเลือก',
    'Final '.$id.' must wait for actual top-three results');
}
$preview=bang1_schedule_preview($schedule,$fixtureRegs);
$previewIds=array_column($preview['rows'],'EventID');
checkIt($previewIds===[15,16,17,18,37,38],
  'Schedule and printed programme must show each official ID once');
foreach($preview['rows'] as $row){
  if(in_array((int)$row['EventID'],[37,38],true)){
    checkIt($row['SlotStatus']==='waiting','Final row should be marked waiting');
  }else{
    checkIt($row['SlotStatus']==='drawn','Existing printed heats must remain drawn');
  }
}
$staff=staff_result_fixture_rows();
checkIt(array_column($staff,'eventId')===[15,16,17,18,37,38],
  'Staff result screen must include all six original fixture IDs');
foreach($staff as $row){
  if(in_array($row['eventId'],[37,38],true)){
    checkIt($row['pendingQualifiers']===true,'Final should remain locked before results');
  }else{
    checkIt($row['pendingDraw']===false && count($row['schools'])>0,
      'All printed heats should be scorable without another draw');
  }
}
// When the ORIGINAL heats are scored, the reserved finals unlock automatically.
foreach([[15,1],[16,2],[17,1],[18,2]] as [$eventId,$heat]){
  $name=$eventId<=16?$male:$female;
  $schools=[];
  foreach($fixtureRegs as $reg){
    if($reg['event_name']===$name&&(int)$reg['heat']===$heat)$schools[]=$reg['school_name'];
  }
  $fixtureResults[]=[
    'event_id'=>$eventId,'heat_no'=>$heat,
    'ranking_json'=>json_encode([
      '1'=>$schools[0],'2'=>$schools[1],'3'=>$schools[2]
    ],JSON_UNESCAPED_UNICODE)
  ];
}
$ready=event_schedule_data();
foreach([37,38] as $id){
  $final=array_values(array_filter($ready,static fn($r)=>(int)$r['EventID']===$id));
  checkIt(count($final)===1 && $final[0]['CompetitionRound']==='ชิงชนะเลิศ',
    'Stored original preliminary results must unlock final '.$id);
  checkIt(count($final[0]['entries'])===6,
    'Exactly six finalists must come from ranks 1-3 of the original two heats');
}
foreach($fixtureRegs as $reg)checkIt($before[$reg['id']]===[(int)$reg['heat'],(int)$reg['lane']],
  'No registration heat or lane can be mutated by read-only schedule operations');
echo "PASS reserved final 37/38, original H1/H2 draw preserved, print and Staff scoring visible\n";
