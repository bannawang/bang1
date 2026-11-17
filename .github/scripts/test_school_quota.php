<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/run/runner-rules.php';
function quota_assert(bool $ok,string $message):void {
    if(!$ok)throw new RuntimeException($message);
}
foreach([6,8,10,12] as $age){
    $event="วิ่ง 100 เมตร ({$age} ปี ชาย)";
    quota_assert(bang1_event_school_limit($event)===null,"Unexpected cap {$age}");
    quota_assert(!bang1_school_registration_quota_full($event,30,false),"Blocked younger {$age}");
}
foreach([14,16,18] as $age){
    foreach(['วิ่ง 100 เมตร','วิ่งผลัด 4X100 เมตร'] as $race){
        $event="{$race} ({$age} ปี หญิง)";
        quota_assert(bang1_event_school_limit($event)===8,"Incorrect cap {$event}");
        quota_assert(!bang1_school_registration_quota_full($event,7,false),"Blocked school 8");
        quota_assert(bang1_school_registration_quota_full($event,8,false),"School 9 not blocked");
        quota_assert(bang1_school_registration_quota_full($event,10,false),"Overfull race not blocked");
        quota_assert(!bang1_school_registration_quota_full($event,8,true),"Existing edit blocked");
    }
}
quota_assert(bang1_event_school_limit('รายการเปิด')===null,'Open race unexpectedly capped');
echo "PASS: eight-school quota for individual and relay events aged 14+\n";
