<?php
declare(strict_types=1);
// Regression: event IDs 37/38 are preset direct finals until their school
// counts exceed the eight-lane cap; auto-split into two qualifying heats
// WITHOUT adding/changing persistent official event IDs or registration rows.
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
$fixtureRegs=[];$fixtureCheckins=[];$fixtureResults=[];
foreach([37=>9,38=>10] as $id=>$count){
  $event=$id===37?$fixtureEvents[1]:$fixtureEvents[2];
  for($i=1;$i<=$count;$i++){
    $heat=$i<=5?1:2;
    $regId=$id*100+$i;
    $fixtureRegs[]=[
      'id'=>$regId,'event_id'=>$id,'event_name'=>$event['name'],
      'category'=>$event['category'],'level'=>$event['level'],
      'school_name'=>'โรงเรียนทดสอบ '.$i,'runner_ids'=>(string)$regId,
      'runner_names'=>'นักกีฬา '.$i,'photos'=>'','heat'=>$heat,
      'lane'=>$heat===1?($i+1):($i-4),
      'created_at'=>'2026-11-19 08:00:00'
    ];
    $fixtureCheckins[]=[
      'registration_id'=>$regId,'athlete_key'=>'runner:'.$regId,
      'checked_at'=>'2026-11-19 09:00:00'
    ];
  }
}
function rows(string $sql,array $params=[]):array {
  global $fixtureEvents,$fixtureRegs,$fixtureResults,$fixtureCheckins;
  if(str_contains($sql,'FROM race_athlete_checkins'))return $fixtureCheckins;
  if(str_contains($sql,'FROM events'))return $fixtureEvents;
  if(str_contains($sql,'FROM registrations'))return $fixtureRegs;
  if(str_contains($sql,'FROM event_results')){
    if(str_contains($sql,"WHERE round_type='คัดเลือก'"))return $fixtureResults;
    return array_map(static fn($r)=>array_merge([
      'round_type'=>'คัดเลือก','staff_name'=>'Test Staff','updated_at'=>'2026-11-19 10:00:00'
    ],$r),$fixtureResults);
  }
  throw new RuntimeException('Unexpected SQL: '.$sql);
}
require dirname(__DIR__,2).'/run/event-management.php';
require dirname(__DIR__,2).'/run/schedule-registration.php';
require dirname(__DIR__,2).'/run/staff-results.php';
function must(bool $cond,string $why):void {if(!$cond)throw new RuntimeException($why);}
$source=event_schedule_data();
$ids=array_map(static fn($row)=>(int)$row['EventID'],$source);
must($ids===[36,37,37,37,38,38,38,39],
  'Keep each official event number and display its H1/H2 and final stage');
foreach([37=>[5,4],38=>[5,5]] as $eventId=>$sizes){
  $group=array_values(array_filter($source,static fn($r)=>(int)$r['EventID']===$eventId));
  must(count($group)===3,'Final-only source requires H1, H2 and waiting final');
  must(array_column($group,'Heat')===['1','2','ชิง'],
    'Final must follow its two preliminary heats');
  must(array_column($group,'CompetitionRound')===
    ['คัดเลือก','คัดเลือก','รอผลการแข่งขันรอบคัดเลือก'],
    'A race with 9/10 schools must no longer be a direct final');
  must(array_map(static fn($r)=>(int)$r['TeamCount'],array_slice($group,0,2))===$sizes,
    'Correct 5/4 or 5/5 split by real school count');
  must((int)$group[2]['QualificationRequiredHeats']===2,
    'Final must wait for exactly two qualifying heats');
}
$preview=bang1_schedule_preview($source,$fixtureRegs);
foreach([37=>[5,4],38=>[5,5]] as $eventId=>$sizes){
  $group=array_values(array_filter($preview['rows'],static fn($r)=>(int)$r['EventID']===$eventId));
  must(array_column($group,'SlotStatus')===['drawn','drawn','waiting'],
    'Drawn heats and pending final must remain distinguishable');
  must(array_map(static fn($r)=>(int)$r['RegisteredTeams'],array_slice($group,0,2))===$sizes,
    'Each scored heat must have its OWN entrants only');
}
$staff=staff_result_fixture_rows();
foreach([37,38] as $id){
  $group=array_values(array_filter($staff,static fn($x)=>(int)$x['eventId']===$id));
  must(count($group)===3,'Staff must see two separate heats and one final');
  must(array_column($group,'round')===['คัดเลือก','คัดเลือก','ชิงชนะเลิศ'],
    'Staff must keep preliminary and final rankings separate');
  must(!$group[0]['pendingDraw']&&!$group[1]['pendingDraw'],
    'Both already drawn heats must be available for independent scoring');
  must($group[2]['pendingQualifiers']===true,
    'Final selection must be locked until the top three in BOTH heats are recorded');
}
// Once Staff saves places 1..3 in both heats, each conditional final unlocks.
foreach([37,38] as $id){
  foreach([1,2] as $heat){
    $rankings=[];
    foreach($fixtureRegs as $reg){
      if((int)$reg['event_id']!==$id || (int)$reg['heat']!==$heat)continue;
      $rankings[]=$reg['school_name'];
    }
    $fixtureResults[]=[
      'event_id'=>$id,'heat_no'=>$heat,
      'ranking_json'=>json_encode(['1'=>$rankings[0],'2'=>$rankings[1],'3'=>$rankings[2]],
        JSON_UNESCAPED_UNICODE)
    ];
  }
}
foreach([37,38] as $id){
  $group=array_values(array_filter(event_schedule_data(),static fn($x)=>(int)$x['EventID']===$id));
  must($group[2]['CompetitionRound']==='ชิงชนะเลิศ',
    'Official top-three results from each heat should unlock its final');
  must(count($group[2]['entries'])===6,
    'Final should contain exactly six qualifying schools');
  must(array_column($group[2]['entries'],'Lane')===[2,3,4,5,6,7],
    'Finalist lanes must follow existing qualifying rules');
}
echo "PASS conditional final 37/38 auto-prelim 5+4 and 5+5, official scoring and 6-school final\n";
