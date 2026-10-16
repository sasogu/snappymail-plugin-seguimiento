<?php
declare(strict_types=1);
require __DIR__ . '/../Store.php';

use CorreoSeguimiento\Store;

function expect(bool $condition, string $description): void {
    if (!$condition) throw new RuntimeException($description);
}
$path = sys_get_temp_dir() . '/seguimiento-test-' . bin2hex(random_bytes(8)) . '.sqlite';
try {
    $store = new Store($path);
    $input = ['message_id' => '<test@example.org>', 'folder' => 'INBOX', 'uid' => 12,
        'subject' => 'Confirmación de formación', 'sender' => 'centro@example.org',
        'state' => 'esperar', 'due' => '2026-01-01', 'note' => 'Confirmar las fechas'];
    $first = $store->save('owner-a', 'account-a', $input);
    $store->save('owner-b', 'account-a', $input + []);
    $store->save('owner-a', 'account-b', $input + []);
    expect(count($store->list('owner-a', 'account-a')) === 1, 'Aislamiento por usuario y cuenta');
    expect($store->find('owner-b', 'account-a', $first['id']) === null, 'No acceder a seguimiento de otro usuario');
    expect($store->find('owner-a', 'account-b', $first['id']) === null, 'No acceder a otra cuenta');
    expect(!$store->remove('owner-b', 'account-a', $first['id']), 'No retirar marcas de otro usuario');
    $store->save('owner-a', 'account-a', array_replace($input, ['folder' => 'Archivo', 'uid' => 99, 'state' => 'resuelto']));
    $rows = $store->list('owner-a', 'account-a');
    expect(count($rows) === 1 && $rows[0]['folder'] === 'Archivo', 'Actualizar el mismo Message-ID sin duplicarlo');
    expect($rows[0]['overdue'] === 0, 'Los resueltos no vencen');
    $store->save('owner-a', 'account-a', array_replace($input, ['due' => Store::today(), 'state' => 'responder']));
    expect($store->list('owner-a', 'account-a')[0]['overdue'] === 1, 'Incluir las revisiones de hoy');
    foreach ([['due' => '2026-02-30'], ['state' => 'inventado'], ['message_id' => "x\r\nALL"],
        ['message_id' => '<x> ALL'], ['message_id' => '<x)><y>'], ['note' => str_repeat('x', 2001)],
        ['uid' => 0], ['subject' => ['array inesperado']]] as $invalid) {
        $rejected = false;
        try { $store->save('owner-a', 'account-a', array_replace($input, $invalid)); }
        catch (InvalidArgumentException $error) { $rejected = true; }
        expect($rejected, 'Rechazar entrada inválida');
    }
    unset($store);
    $reopened = new Store($path);
    expect(count($reopened->list('owner-a', 'account-a')) === 1, 'Persistencia tras reabrir');
    expect($reopened->refreshDue('2025-01-01') === 0, 'El proceso periódico respeta la fecha');
    expect($reopened->remove('owner-a', 'account-a', $first['id']), 'Retirar solo el seguimiento seleccionado');
    expect(count($reopened->list('owner-b', 'account-a')) === 1, 'Conservar las otras marcas');
    echo "OK: aislamiento, persistencia, estados, vencimientos y validación.\n";
} finally {
    unset($store, $reopened);
    foreach ([$path, $path . '-shm', $path . '-wal'] as $file) {
        if (is_file($file)) unlink($file);
    }
}
