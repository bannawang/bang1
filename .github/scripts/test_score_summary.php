<?php
declare(strict_types=1);
/**
 * Read-only regression for official Banglamung 1 championship score summary.
 * No database connection, no INSERT/UPDATE/DELETE and no real runner data.
 */
$action='unit_test';
$fixtures=[];
function rows(string $sql,array $params=[]):array {
    if(str_contains($sql,'FROM schools'))return [
        ['id'=>1,'name'=>'โรงเรียน ก'],
        ['id'=>2,'name'=>'โรงเรียน ข'],
        ['id'=>3,'name'=>'โรงเรียน ค'],
        ['id'=>4,'name'=>'โรงเรียน ง']
    ];
    throw new RuntimeException('Unexpected database query: '.$sql);
}
function staff_result_fixture_rows():array{
    global $fixtures;
    return $fixtures;
}
require dirname(__DIR__,2).'/run/score-summary.php';
function confirm(bool $ok,string $description):void{
    if(!$ok)throw new RuntimeException('FAIL: '.$description);
}
function bySchool(array $result):array{
    $output=[];
    foreach($result['schools'] as $school)$output[$school['schoolName']]=$school;
    return $output;
}
function resultFixture(int $id,string $name,string $category,string $round,array $ranks):array{
    return [
        'eventId'=>$id,'eventName'=>$name,'category'=>$category,
        'round'=>$round,'heat'=>1,'fixtureKey'=>$id.'|'.$round.'|1',
        'ranks'=>$ranks
    ];
}
// No official finals recorded: scores remain zero and ranks are unassigned.
$empty=bang1_score_summary();
confirm($empty['scoredFixtures']===0 && $empty['finalFixtures']===0,'No completed finals');
foreach($empty['schools'] as $s){
    confirm($s['total']===0 && $s['rank']===null,'Zero score must not be declared first');
}
$fixtures=[
    resultFixture(1,'วิ่ง 60 เมตร (6 ปี ชาย)','วิ่งเดี่ยว','ชิงชนะเลิศ',
        ['1'=>'โรงเรียน ก','2'=>'โรงเรียน ข','3'=>'โรงเรียน ค','4'=>'โรงเรียน ง']),
    resultFixture(2,'วิ่งผลัด 4X50 เมตร (6 ปี หญิง)','วิ่งผลัด','ชิงชนะเลิศ',
        ['1'=>'โรงเรียน ค','2'=>'โรงเรียน ก','3'=>'โรงเรียน ข','4'=>'โรงเรียน ง']),
    resultFixture(3,'วิ่ง 80 เมตร (8 ปี หญิง)','วิ่งเดี่ยว','ชิงชนะเลิศ',
        ['1'=>'โรงเรียน ข','2'=>'โรงเรียน ค','3'=>'โรงเรียน ก']),
    // The same age/discipline preliminary must never be awarded points.
    resultFixture(4,'วิ่ง 60 เมตร (6 ปี ชาย)','วิ่งเดี่ยว','คัดเลือก',
        ['1'=>'โรงเรียน ง','2'=>'โรงเรียน ง','3'=>'โรงเรียน ง']),
];
$result=bang1_score_summary();
$map=bySchool($result);
confirm($result['scoredFixtures']===3 && $result['finalFixtures']===3,
    'Only three saved finals count; preliminary excluded');
confirm($map['โรงเรียน ก']['byAge'][6]===10 && $map['โรงเรียน ก']['byAge'][8]===2,
    'Individual first plus relay second is 10 at age six; age eight third is two');
confirm($map['โรงเรียน ข']['byAge'][6]===6 && $map['โรงเรียน ข']['byAge'][8]===5,
    'Individual second plus relay third is six; first at age eight five');
confirm($map['โรงเรียน ค']['byAge'][6]===9 && $map['โรงเรียน ค']['byAge'][8]===3,
    'Individual third plus relay first is nine; second at age eight three');
confirm($map['โรงเรียน ก']['total']===12 && $map['โรงเรียน ค']['total']===12,
    'Sum across all age groups');
confirm($map['โรงเรียน ข']['total']===11 && $map['โรงเรียน ง']['total']===0,
    'Fourth place never receives points');
confirm($map['โรงเรียน ก']['rank']===1 && $map['โรงเรียน ค']['rank']===1 &&
    $map['โรงเรียน ข']['rank']===3 && $map['โรงเรียน ง']['rank']===4,
    'Tied first places produce 1, 1, 3, 4 competition ranking');
confirm($result['scoring']['วิ่งเดี่ยว']===[5,3,2] &&
    $result['scoring']['วิ่งผลัด']===[7,5,3],
    'Required point tables must not change');
foreach([10,12,14,16] as $age){
    foreach($map as $s)confirm($s['byAge'][$age]===0,'Other age groups remain unscored');
}
// A repeated fixture key must never grant the same points twice.
$fixtures[]=resultFixture(2,'วิ่งผลัด 4X50 เมตร (6 ปี หญิง)',
    'วิ่งผลัด','ชิงชนะเลิศ',['1'=>'โรงเรียน ง']);
$repeat=bySchool(bang1_score_summary());
confirm($repeat['โรงเรียน ค']['total']===12 && $repeat['โรงเรียน ง']['total']===0,
    'A duplicate fixture key cannot inflate competition scores');
// Validate the remaining age classes, regardless of whether a school was registered
// under an imported or later-edited school name.
$fixtures=[
    resultFixture(10,'วิ่ง 100 เมตร (10 ปี ชาย)','วิ่งเดี่ยว','ชิงชนะเลิศ',
        ['1'=>'โรงเรียน ก']),
    resultFixture(11,'วิ่ง 100 เมตร (12 ปี หญิง)','วิ่งเดี่ยว','ชิงชนะเลิศ',
        ['1'=>'โรงเรียน ข']),
    resultFixture(12,'วิ่งผลัด 4X100 เมตร (14 ปี ชาย)','วิ่งผลัด','ชิงชนะเลิศ',
        ['1'=>'โรงเรียน ค']),
    resultFixture(13,'วิ่ง 400 เมตร (16 ปี ชาย)','วิ่งเดี่ยว','ชิงชนะเลิศ',
        ['1'=>'โรงเรียน ง']),
];
$other=bySchool(bang1_score_summary());
confirm($other['โรงเรียน ก']['byAge'][10]===5 &&
    $other['โรงเรียน ข']['byAge'][12]===5 &&
    $other['โรงเรียน ค']['byAge'][14]===7 &&
    $other['โรงเรียน ง']['byAge'][16]===5,
    'All six age groups are assigned to the proper age column');
// Missing age classification triggers a visible warning, never a random age bucket.
$fixtures=[resultFixture(14,'วิ่งระยะพิเศษ','วิ่งเดี่ยว','ชิงชนะเลิศ',
    ['1'=>'โรงเรียน ก'])];
$missing=bang1_score_summary();
confirm(count($missing['unclassifiedEvents'])===1 &&
    $missing['scoredFixtures']===0 && bySchool($missing)['โรงเรียน ก']['total']===0,
    'Unknown age does not silently award points');
echo "PASS scoring: individual, relay, no fourth-place credit, qualifying exclusion, six ages, ties, duplicate guard, zero state, unknown-age warning\n";
