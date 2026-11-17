<?php
declare(strict_types=1);

/**
 * Decode data from the QR printed on a Banlamung 1 application.
 * New printed forms contain BNWREG:<registration id>.
 * Older sheets may contain their exact registration_key instead.
 * QR contents are always a LOOKUP token, never permission to write.
 */
function bang1_qr_registration_locator(string $value):?array {
    $value=trim($value);
    if($value==='' || strlen($value)>500 ||
       preg_match('/[\x00-\x1f\x7f]/',$value))return null;
    if(preg_match('/^(?:BNWREG:)?([1-9][0-9]{0,17})$/iD',$value,$m)){
        $id=filter_var($m[1],FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        return $id===false?null:['id'=>$id];
    }
    // Legacy QR: exact string stored as registration_key. Never execute,
    // redirect to, or interpret its components as trusted registration fields.
    if(str_contains($value,'|') && !str_contains($value,'://'))
        return ['registration_key'=>$value];
    return null;
}
