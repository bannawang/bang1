<?php
declare(strict_types=1);
/** Scoring screen numbers each displayed heat and counts only its schools. */
$action='';
function staff_fixture_assert(bool $ok,string $message):void {
    if(!$ok)throw new RuntimeException($message);
}
function rows(string $sql,array $params=[]):array {
    if(str_contains($sql,'FROM event_results'))return [
        ['event_id'=>101,'round_type'=>'คัดเลือก','heat_no'=>1,
         'ranking_json'=>json_encode(['1'=>'School 1']),
         'staff_name'=>'Recorder','updated_at'=>'2026-11-18 11:00:00']
    ];
    if(str_contains($sql,'FROM events'))return [
        ['id'=>10,'name'=>'วิ่ง 400 เมตร (16 ปี ชาย)','category'=>'วิ่งเดี่ยว',
         'level'=>'มัธยม','heat'=>1,'stage'=>'ชิงชนะเลิศ','ranking_json'=>''],
        ['id'=>101,'name'=>'วิ่งผลัด 4X50 เมตร (6 ปี ชาย)','category'=>'วิ่งผลัด',
         'level'=>'อนุบาล','heat'=>1,'stage'=>'คัดเลือก','ranking_json'=>''],
        ['id'=>102,'name'=>'วิ่งผลัด 4X50 เมตร (6 ปี ชาย)','category'=>'วิ่งผลัด',
         'level'=>'อนุบาล','heat'=>2,'stage'=>'คัดเลือก','ranking_json'=>'']
    ];
    throw new RuntimeException('Unexpected query: '.$sql);
}
function event_schedule_data():array {
    return [
        ['EventID'=>10,'EventName'=>'วิ่ง 400 เมตร (16 ปี ชาย)',
         'Category'=>'วิ่งเดี่ยว','Level'=>'มัธยม','Gender'=>'ชาย',
         'Stage'=>'ชิงชนะเลิศ','Heat'=>1,'SchoolCount'=>3],
        ['EventID'=>101,'EventName'=>'วิ่งผลัด 4X50 เมตร (6 ปี ชาย)',
         'Category'=>'วิ่งผลัด','Level'=>'อนุบาล','Gender'=>'ชาย',
         'Stage'=>'คัดเลือก','Heat'=>1,'SchoolCount'=>9],
        ['EventID'=>102,'EventName'=>'วิ่งผลัด 4X50 เมตร (6 ปี ชาย)',
         'Category'=>'วิ่งผลัด','Level'=>'อนุบาล','Gender'=>'ชาย',
         'Stage'=>'คัดเลือก','Heat'=>2,'SchoolCount'=>9]
    ];
}
function event_registration_rows():array {
    $regs=[];
    foreach(range(1,3) as $i){
        $regs[]=['event_name'=>'วิ่ง 400 เมตร (16 ปี ชาย)',
            'category'=>'วิ่งเดี่ยว','level'=>'มัธยม',
            'school_name'=>'Other '.$i,'heat'=>1];
    }
    foreach(range(1,9) as $i){
        $regs[]=['event_name'=>'วิ่งผลัด 4X50 เมตร (6 ปี ชาย)',
            'category'=>'วิ่งผลัด','level'=>'อนุบาล',
            'school_name'=>'School '.$i,'heat'=>$i<=5?1:2];
    }
    return $regs;
}
function event_matching_regs(array $event,array $regs):array {
    return array_values(array_filter($regs,static fn($r)=>
        $r['event_name']===$event['name']
        &&$r['category']===$event['category']
        &&$r['level']===$event['level']));
}
function event_schools(array $regs):array {
    return array_values(array_unique(array_column($regs,'school_name')));
}
function event_heat_sizes(int $teams):array {
    if($teams<=8)return [$teams];
    $num=(int)ceil($teams/8);
    $base=intdiv($teams,$num);
    return array_map(static fn($i)=>$base+($i<$teams%$num?1:0),range(0,$num-1));
}
require dirname(__DIR__,2).'/run/staff-results.php';
$out=staff_result_fixture_rows();
staff_fixture_assert(count($out)===3,'Each heat must be its own scoring fixture');
staff_fixture_assert(array_column($out,'fixtureNumber')===[1,2,3],
    'Fixture numbers must be stable and consecutive across heats');
staff_fixture_assert(array_column($out,'registeredSchools')===[3,5,4],
    'Display individual heat counts (5 and 4), not nine for each heat');
staff_fixture_assert(count($out[1]['schools'])===5&&count($out[2]['schools'])===4,
    'Eligible school lists must remain isolated per heat');
staff_fixture_assert($out[1]['fixtureKey']!==$out[2]['fixtureKey'],
    'Each heat must have a unique result storage key');
staff_fixture_assert($out[1]['isSaved']===true&&$out[2]['isSaved']===false,
    'Saving heat one must not set heat two to saved');
echo "PASS staff scoring fixture numbering and independent heat counts\n";
