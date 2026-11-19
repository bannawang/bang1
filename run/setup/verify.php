<?php
declare(strict_types=1);
require __DIR__.'/../inc/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !hash_equals(config('deploy_token'), (string)($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? ''))) {
    json_out(['success'=>false,'message'=>'Forbidden'],403);
}
header('Cache-Control: no-store, private');
$tables=['source_rows','schools','coaches','runners','events','registrations','heats','feature_config','audit_logs','race_results','certificates','import_batches','race_history_batches','race_history_results'];
$out=[];
try {
  foreach($tables as $t) {
    $q=db()->query('SELECT COUNT(*) FROM `'.$t.'`');
    $out[$t]=(int)$q->fetchColumn();
  }
  $stats=[];
  $queries=[
    'coaches_missing_email'=>'SELECT COUNT(*) FROM coaches WHERE email = "" OR email IS NULL',
    'coaches_missing_school'=>'SELECT COUNT(*) FROM coaches WHERE school_name = "" OR school_name IS NULL',
    'runners_missing_school'=>'SELECT COUNT(*) FROM runners WHERE school_name = "" OR school_name IS NULL',
    'runners_missing_name'=>'SELECT COUNT(*) FROM runners WHERE first_name = "" OR last_name = ""',
    'runners_missing_birth_year'=>'SELECT COUNT(*) FROM runners WHERE birth_year IS NULL',
    'runners_with_drive_photo'=>'SELECT COUNT(*) FROM runners WHERE photo_url IS NOT NULL AND photo_url <> ""',
    'runners_with_id_proof'=>'SELECT COUNT(*) FROM runners WHERE proof_url IS NOT NULL AND proof_url <> ""',
    'registrations_unlinked_event'=>'SELECT COUNT(*) FROM registrations WHERE event_id IS NULL',
    'registrations_missing_school'=>'SELECT COUNT(*) FROM registrations WHERE school_name = "" OR school_name IS NULL',
    'registrations_missing_runner'=>'SELECT COUNT(*) FROM registrations WHERE runner_ids = "" OR runner_ids IS NULL',
  ];
  foreach($queries as $k=>$sql)$stats[$k]=(int)db()->query($sql)->fetchColumn();
  $sourceRows=db()->query('SELECT sheet_name, COUNT(*) AS total FROM source_rows GROUP BY sheet_name ORDER BY sheet_name')->fetchAll(PDO::FETCH_ASSOC);
  $roles=db()->query('SELECT role, COUNT(*) AS total FROM coaches GROUP BY role ORDER BY role')->fetchAll(PDO::FETCH_ASSOC);
  $alerts=[];
  if($out['coaches']===0)$alerts[]='NO_LOGIN_ACCOUNTS';
  if($out['runners']===0)$alerts[]='NO_RUNNERS_IN_NORMALIZED_TABLE';
  if($out['events']===0)$alerts[]='NO_EVENTS_IN_NORMALIZED_TABLE';
  if($stats['registrations_unlinked_event']>0)$alerts[]='UNLINKED_REGISTRATIONS';
  if($stats['runners_missing_name']>0)$alerts[]='MISSING_RUNNER_NAMES';
  // Deployment-only aggregate diagnostic for the published two-heat final.
  // No names, runner IDs, document URLs or photos are sent to workflow logs.
  $event31Summary=null;
  $finalEventStmt=db()->prepare('SELECT name,category,level FROM events WHERE id=? LIMIT 1');
  $finalEventStmt->execute([31]);
  $finalEvent=$finalEventStmt->fetch(PDO::FETCH_ASSOC);
  if($finalEvent){
    $heatStmt=db()->prepare('SELECT COALESCE(heat,0) heat, COUNT(*) entries, COUNT(DISTINCT school_name) schools
        FROM registrations WHERE event_name=? AND category <=> ? AND level <=> ?
        GROUP BY COALESCE(heat,0) ORDER BY heat');
    $heatStmt->execute([$finalEvent['name'],$finalEvent['category'],$finalEvent['level']]);
    $heatCounts=array_map(static fn($row)=>[
      'heat'=>(int)$row['heat'],'entries'=>(int)$row['entries'],
      'schools'=>(int)$row['schools']
    ],$heatStmt->fetchAll(PDO::FETCH_ASSOC));
    $savedStmt=db()->query("SELECT event_id,heat_no,ranking_json FROM event_results
      WHERE event_id IN (23,24) AND round_type='คัดเลือก' ORDER BY event_id,heat_no");
    $savedResults=[];
    foreach($savedStmt->fetchAll(PDO::FETCH_ASSOC) as $item){
      $ranks=json_decode((string)($item['ranking_json']??''),true);
      $complete=is_array($ranks);
      foreach([1,2,3] as $rank){
        if(trim((string)($ranks[(string)$rank]??''))==='')$complete=false;
      }
      $savedResults[]=[
        'event_id'=>(int)$item['event_id'],
        'heat'=>(int)$item['heat_no'],
        'complete_top_three'=>$complete
      ];
    }
    $event31Summary=['heat_counts'=>$heatCounts,'official_heat_results'=>$savedResults];
  }
  // Read-only production diagnostics for official races 37 and 38.
  // Aggregate counts and fixture identities only: NO names, athletes or documents.
  $race37_38=[];
  $query=db()->query("SELECT id,name,category,level,gender,remark,heat,heat_plan,stage
    FROM events WHERE id IN (37,38) ORDER BY id");
  $eventRows=$query->fetchAll(PDO::FETCH_ASSOC);
  foreach($eventRows as $ev){
    $id=(int)$ev['id'];
    $st=db()->prepare('SELECT COALESCE(heat,0) heat, COUNT(*) entries,
      COUNT(DISTINCT school_name) schools,
      SUM(CASE WHEN lane IS NOT NULL AND lane BETWEEN 1 AND 8 THEN 1 ELSE 0 END) valid_lanes,
      COUNT(DISTINCT CASE WHEN lane BETWEEN 1 AND 8 THEN CONCAT(heat,":",lane) ELSE NULL END) distinct_heat_lanes
      FROM registrations WHERE event_name=? AND category <=> ? AND level <=> ?
      GROUP BY COALESCE(heat,0) ORDER BY heat');
    $st->execute([$ev['name'],$ev['category'],$ev['level']]);
    $heatStats=array_map(static fn($x)=>[
      'heat'=>(int)$x['heat'],'entries'=>(int)$x['entries'],
      'schools'=>(int)$x['schools'],'valid_lanes'=>(int)$x['valid_lanes'],
      'distinct_heat_lanes'=>(int)$x['distinct_heat_lanes']
    ],$st->fetchAll(PDO::FETCH_ASSOC));
    $race37_38[$id]=[
      'source'=>['remark'=>$ev['remark'],'heat'=>$ev['heat'],'plan'=>$ev['heat_plan'],'stage'=>$ev['stage']],
      'registration_heats'=>$heatStats,
      'schedule'=>[],'preview'=>[],'staff'=>[]
    ];
  }
  if($race37_38){
    $action='deployment_diagnostics';
    function rows(string $sql,array $params=[]):array{
      $q=db()->prepare($sql);$q->execute($params);return $q->fetchAll(PDO::FETCH_ASSOC);
    }
    require_once dirname(__DIR__).'/event-management.php';
    require_once dirname(__DIR__).'/schedule-registration.php';
    require_once dirname(__DIR__).'/staff-results.php';
    $allFixtures=event_schedule_data();
    $previewRegs=rows('SELECT id,event_id,event_name,category,level,school_name,runner_names,heat,lane,created_at FROM registrations ORDER BY created_at,id');
    $allPreview=bang1_schedule_preview($allFixtures,$previewRegs)['rows'];
    $allStaff=staff_result_fixture_rows();
    foreach($race37_38 as $id=>&$entry){
      foreach($allFixtures as $f)if((int)($f['EventID']??0)===(int)$id)
        $entry['schedule'][]=[
          'heat'=>(string)($f['Heat']??''),'plan'=>(string)($f['HeatPlan']??''),
          'round'=>(string)($f['CompetitionRound']??''),
          'teams'=>(int)($f['TeamCount']??0),'entries'=>count($f['entries']??[])
        ];
      foreach($allPreview as $f)if((int)($f['EventID']??0)===(int)$id)
        $entry['preview'][]=[
          'heat'=>(string)($f['Heat']??''),
          'status'=>(string)($f['SlotStatus']??''),
          'teams'=>(int)($f['RegisteredTeams']??0),'entries'=>count($f['entries']??[])
        ];
      foreach($allStaff as $f)if((int)($f['eventId']??0)===(int)$id)
        $entry['staff'][]=[
          'round'=>(string)($f['round']??''),'heat'=>(int)($f['heat']??0),
          'schools'=>(int)($f['registeredSchools']??0),
          'pending_draw'=>(bool)($f['pendingDraw']??true)
        ];
    }
    unset($entry);
  }
  json_out([
    'success'=>true,
    'source_rows_total'=>$out['source_rows'],
    'table_counts'=>$out,
    'quality_counts'=>$stats,
    'source_sheets'=>$sourceRows,
    'coach_roles'=>$roles,
    'alerts'=>$alerts,
    'event31_qualifier_summary'=>$event31Summary,
    'race37_38_diagnostics'=>$race37_38,
    'note'=>'Counts only: no names, passwords or personal data in output',
  ]);
} catch(Throwable $e) {
  error_log('Bang1 verification failed: '.$e->getMessage());
  json_out(['success'=>false,'message'=>'Database verification failed'],500);
}
