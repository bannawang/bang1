<?php
declare(strict_types=1);
// Regression for imported event numbers 37/38: single final-only
// fixture with >8 enrolled schools must not be dropped or duplicated.
$action='unit-test';
$fixtureEvents=[
 ['id'=>36,'name'=>'วิ่ง 100 เมตร (12 ปี หญิง)','category'=>'วิ่งเดี่ยว','level'=>'ประถม','gender'=>'หญิง',
  'remark'=>'คัดเลือก','heat'=>'2','heat_plan'=>'2','team_count'=>5,'total_teams'=>10,
  'stage'=>'คัดเลือก','ranking_json'=>null,'source_order'=>36],
 ['id'=>37,'name'=>'วิ่ง 80 เมตร (6 ปี ชาย)','category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','gender'=>'ชาย',
  'remark'=>'ชิงชนะเลิศ','heat'=>'ชิง','heat_plan'=>'ชิง','team_count'=>9,'total_teams'=>9,
  'stage'=>'ชิงชนะเลิศ','ranking_json'=>null,'source_order'=>37],
 ['id'=>38,'name'=>'วิ่ง 80 เมตร (6 ปี หญิง)','category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','gender'=>'หญิง',
  'remark'=>'ชิงชนะเลิศ','heat'=>'ชิง','heat_plan'=>'ชิง','team_count'=>10,'total_teams'=>10,
  'stage'=>'ชิงชนะเลิศ','ranking_json'=>null,'source_order'=>38],
 ['id'=>39,'name'=>'วิ่งผลัด 4X50 เมตร (8 ปี ชาย)','category'=>'วิ่งผลัด','level'=>'ประถม','gender'=>'ชาย',
  'remark'=>'คัดเลือก','heat'=>'1','heat_plan'=>'1','team_count'=>5,'total_teams'=>10,
  'stage'=>'คัดเลือก','ranking_json'=>null,'source_order'=>39]
];
$fixtureRegs=[];
foreach([37=>9,38=>10] as $id=>$count){
  $event=$id===37?$fixtureEvents[1]:$fixtureEvents[2];
  for($i=1;$i<=$count;$i++)$fixtureRegs[]=[
    'id'=>$id*100+$i,'event_id'=>$id,'event_name'=>$event['name'],
    'category'=>$event['category'],'level'=>$event['level'],
    'school_name'=>'โรงเรียนทดสอบ '.$i,'runner_ids'=>(string)($id*100+$i),
    'runner_names'=>'นักกีฬา '.$i,'photos'=>'','heat'=>0,'lane'=>null,
    'created_at'=>'2026-11-19 08:00:00'
  ];
}
function rows(string $sql,array $params=[]):array{
  global $fixtureEvents,$fixtureRegs;
  if(str_contains($sql,'FROM race_athlete_checkins'))return [];
  if(str_contains($sql,'FROM events'))return $fixtureEvents;
  if(str_contains($sql,'FROM registrations'))return $fixtureRegs;
  if(str_contains($sql,'FROM event_results'))return [];
  throw new RuntimeException('Unexpected SQL: '.$sql);
}
require dirname(__DIR__,2).'/run/event-management.php';
require dirname(__DIR__,2).'/run/schedule-registration.php';
$source=event_schedule_data();
function must(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
$ids=array_map(static fn($x)=>(int)$x['EventID'],$source);
must($ids===[36,37,38,39],'Official event order must include 37 and 38 exactly once');
$preview=bang1_schedule_preview($source,$fixtureRegs);
$rows=$preview['rows'];
$byId=[];foreach($rows as $row)$byId[(int)$row['EventID']]=$row;
foreach([37=>9,38=>10] as $id=>$count){
  $row=$byId[$id]??[];
  must(($row['SlotStatus']??'')==='needs_qualifier_setup',
    'Final-only competition '.$id.' must flag missing prelim configuration');
  must((int)($row['RegisteredTeams']??0)===$count,
    'Actual registered schools lost for event '.$id);
  must(count($row['entries']??[])===$count,
    'Real registered schools must remain visible in program '.$id);
  must((int)($row['QualificationRequiredHeats']??0)===2,
    'Over eight schools require two independent preliminary heats');
  foreach($row['entries'] as $entry)must($entry['Lane']===null && $entry['Heat']===null,
    'Do not invent official lane or heat assignments for event '.$id);
}
echo "PASS imported final-only IDs 37-38 preserved with all 9/10 schools and no fictitious lanes\n";
