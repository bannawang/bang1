<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/run/final-qualification.php';
require dirname(__DIR__,2).'/run/live-final-qualification.php';
function locked_test(bool $ok,string $msg):void {if(!$ok)throw new RuntimeException($msg);}
$reg=['id'=>23,'event_id'=>23,'event_name'=>'วิ่ง 60 เมตร (6 ปี ชาย)',
  'category'=>'วิ่งเดี่ยว','level'=>'อนุบาล','school_name'=>'School A',
  'runner_ids'=>'101,102','runner_names'=>'Reserve,Confirmed',
  'photos'=>'https://example.test/1.jpg,https://example.test/2.jpg','heat'=>1,'lane'=>2];
$selected=bang1_qualifying_confirmed_roster($reg,['runner:102'=>'2026-11-17 19:09:50']);
locked_test($selected['RunnerIDs']==='102'&&$selected['RunnerName']==='Confirmed',
 'Unchecked alternate must not replace confirmed athlete');
locked_test($selected['Photos']==='https://example.test/2.jpg','Photo follows chosen athlete');
$none=bang1_qualifying_confirmed_roster($reg,[]);
locked_test($none['RunnerIDs']===''&&$none['RunnerName']===''&&$none['Photos']==='',
 'Unconfirmed registration cannot automatically choose first reserve');
$relay=array_merge($reg,['category'=>'วิ่งผลัด','event_name'=>'วิ่งผลัด 4X50 เมตร (6 ปี ชาย)',
 'runner_ids'=>'201,202,203,204,205','runner_names'=>'R1,R2,R3,R4,R5',
 'photos'=>'a,b,c,d,e']);
$r=bang1_qualifying_confirmed_roster($relay,[
 'runner:205'=>'2026-11-17 09:05:00','runner:204'=>'2026-11-17 09:04:00',
 'runner:203'=>'2026-11-17 09:03:00','runner:202'=>'2026-11-17 09:02:00',
 'runner:201'=>'2026-11-17 09:01:00']);
locked_test($r['RunnerIDs']==='201,202,203,204','Relay keeps four earliest confirmations in roster order');
$fixture=['EventID'=>31,'EventName'=>$reg['event_name'],'Category'=>$reg['category'],
 'Level'=>$reg['level'],'HeatPlan'=>'ชิง','CompetitionRound'=>'ชิงชนะเลิศ',
 'QualificationPending'=>false,'entries'=>[]];
$regs=[];
foreach(range(2,7) as $i){
 $source=$reg;$source['id']=23+$i;$source['school_name']='School '.$i;
 $regs[]=$source;
 $fixture['entries'][]=[
   'RegistrationID'=>$source['id'],'SchoolName'=>$source['school_name'],
   'Lane'=>$i,'RunnerIDs'=>$selected['RunnerIDs'],'RunnerName'=>$selected['RunnerName'],
   'Photos'=>$selected['Photos']
 ];
}
$unchanged=$regs;
$final=bang1_live_final_registration_rows([$fixture],$regs);
locked_test(count($final)===6&&$regs===$unchanged,'Final must keep six schools and not mutate source');
foreach($final as $entry){
 locked_test($entry['runner_ids']==='102'&&$entry['runner_names']==='Confirmed',
   'LIVE final must show ONLY confirmed runner');
 locked_test($entry['photos']==='https://example.test/2.jpg','Final image must match confirmed athlete');
}
echo "PASS selected prelim athlete transfers unchanged to final; alternatives excluded\n";
