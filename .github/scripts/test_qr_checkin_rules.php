<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/run/qr-checkin-rules.php';
function qr_assert(bool $v,string $msg):void {if(!$v)throw new RuntimeException($msg);}
qr_assert(bang1_qr_registration_locator('BNWREG:562')===['id'=>562],'Printed QR ID');
qr_assert(bang1_qr_registration_locator('bnwreg:562')===['id'=>562],'Case-insensitive prefix');
qr_assert(bang1_qr_registration_locator('562')===['id'=>562],'Manual numeric fallback');
qr_assert(bang1_qr_registration_locator('  BNWREG:562  ')===['id'=>562],'Whitespace');
$key='23|วิ่งเดี่ยว|อนุบาล|โรงเรียนตัวอย่าง';
qr_assert(bang1_qr_registration_locator($key)===['registration_key'=>$key],
    'Legacy QR registration key');
foreach(['', 'BNWREG:0', 'BNWREG:-1', 'BNWREG:1 OR 1=1',
        'https://bad.test/23|key', "BNWREG:562\nmalicious",
        str_repeat('A',501), '0123'] as $bad){
    qr_assert(bang1_qr_registration_locator($bad)===null,'Invalid input accepted');
}
echo "PASS: current and legacy registration QR parsing with invalid token rejection\n";
