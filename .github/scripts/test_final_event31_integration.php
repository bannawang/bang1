<?php
declare(strict_types=1);
// Validate the real schedule composer with isolated rows, not real students.
$action='unit-test';
$fixtureEvents=[
 ['id'=>23,'name'=>'วิ่ง 60 เมตร (6 ปี ชาย)','category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','gender'=>'ชาย','remark'=>'คัดเลือก','heat'=>'1','heat_plan'=>'1','team_count'=>5,'total_teams'=>10,'stage'=>'คัดเลือก','ranking_json'=>null,'source_order'=>23],
 ['id'=>24,'name'=>'วิ่ง 60 เมตร (6 ปี ชาย)','category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','gender'=>'ชาย','remark'=>'คัดเลือก','heat'=>'2','heat_plan'=>'2','team_count'=>5,'total_teams'=>10,'stage'=>'คัดเลือก','ranking_json'=>null,'source_order'=>24],
 ['id'=>31,'name'=>'วิ่ง 60 เมตร (6 ปี ชาย)','category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','gender'=>'ชาย','remark'=>'คัดเลือก','heat'=>'ชิง','heat_plan'=>'ชิง','team_count'=>null,'total_teams'=>10,'stage'=>'ชิงชนะเลิศ','ranking_json'=>null,'source_order'=>31]
];
$fixtureRegs=[];$fixtureCheckins=[];
foreach([1,2] as $heat)for($r=1;$r<=5;$r++){
    $school="โรงเรียน H{$heat}-{$r}";
    $fixtureRegs[]=['id'=>$heat*10+$r,'event_id'=>$heat===1?23:24,
        'event_name'=>'วิ่ง 60 เมตร (6 ปี ชาย)','category'=>'วิ่งเดี่ยว','level'=>'อนุบาล',
        'school_name'=>$school,'runner_ids'=>(string)($heat*10+$r),
        'runner_names'=>'เด็ก '.$r,'photos'=>'https://example.test/athlete.jpg',
        'heat'=>$heat,'lane'=>$r];
    $fixtureCheckins[]=['registration_id'=>$heat*10+$r,
        'athlete_key'=>'runner:'.($heat*10+$r),'checked_at'=>'2026-11-17 08:00:00'];
}
$fixtureResults=[
    ['event_id'=>23,'heat_no'=>1,'ranking_json'=>json_encode(['1'=>'โรงเรียน H1-1','2'=>'โรงเรียน H1-2','3'=>'โรงเรียน H1-3'],JSON_UNESCAPED_UNICODE)],
    ['event_id'=>24,'heat_no'=>2,'ranking_json'=>json_encode(['1'=>'โรงเรียน H2-1','2'=>'โรงเรียน H2-2','3'=>'โรงเรียน H2-3'],JSON_UNESCAPED_UNICODE)]
];
function rows(string $sql,array $params=[]):array{
    global $fixtureEvents,$fixtureRegs,$fixtureResults,$fixtureCheckins;
    if(str_contains($sql,'FROM race_athlete_checkins'))return $fixtureCheckins;
    if(str_contains($sql,'FROM events'))return $fixtureEvents;
    if(str_contains($sql,'FROM registrations'))return $fixtureRegs;
    if(str_contains($sql,'FROM event_results'))return $fixtureResults;
    throw new RuntimeException('Unexpected query: '.$sql);
}
require dirname(__DIR__,2).'/run/event-management.php';
function expect_final(bool $condition,string $msg):void{
    if(!$condition)throw new RuntimeException($msg);
}
function fixture31():array{
    foreach(event_schedule_data() as $row){
        if((int)($row['EventID']??0)===31)return $row;
    }
    throw new RuntimeException('Final 31 missing');
}
$final=fixture31();
expect_final($final['CompetitionRound']==='ชิงชนะเลิศ','Official 23/24 results did not advance 31');
expect_final(count($final['entries']??[])===6,'Event 31 must have six finalists');
expect_final(count(array_filter($final['entries'],fn($e)=>($e['ConfirmedAthletes']??0)===1))===6,
    'Final must inherit only prelim-confirmed athletes');
expect_final(array_column($final['entries'],'Lane')===[2,3,4,5,6,7],'Wrong final lane allocation');
expect_final(($final['QualificationPending']??null)===false,'Ready final still marked waiting');
$fixtureRegs[]=['id'=>999,'event_id'=>23,'event_name'=>'วิ่ง 60 เมตร (6 ปี ชาย)',
    'category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','school_name'=>'โรงเรียนเข้ามาใหม่',
    'runner_ids'=>'999','runner_names'=>'นักกรีฑารอจัดฮีท','photos'=>'',
    'heat'=>0,'lane'=>null];
$lateFinal=fixture31();
expect_final($lateFinal['CompetitionRound']==='ชิงชนะเลิศ'
    &&count($lateFinal['entries'])===6,
    'New unassigned signup erased the already saved six-school final');
array_pop($fixtureRegs);
$fixtureResults=array_slice($fixtureResults,0,1);
$pending=fixture31();
expect_final($pending['CompetitionRound']==='รอผลการแข่งขันรอบคัดเลือก','Partial results must stay pending');
expect_final(($pending['QualificationSavedHeats']??0)===1,'Partial results should show one saved heat');
$fixtureResults=[];
$fixtureEvents[0]['ranking_json']=json_encode(['1'=>'โรงเรียน H1-1','2'=>'โรงเรียน H1-2','3'=>'โรงเรียน H1-3'],JSON_UNESCAPED_UNICODE);
$fixtureEvents[1]['ranking_json']=json_encode(['1'=>'โรงเรียน H2-1','2'=>'โรงเรียน H2-2','3'=>'โรงเรียน H2-3'],JSON_UNESCAPED_UNICODE);
$legacy=fixture31();
expect_final($legacy['CompetitionRound']==='ชิงชนะเลิศ','Already displayed seeded result did not advance 31');
echo "PASS: official and seeded H1/H2 qualifiers advance event 31; partial results remain pending\n";
