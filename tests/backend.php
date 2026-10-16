<?php
declare(strict_types=1);
namespace RainLoop\Plugins {
    abstract class AbstractPlugin {
        public array $params = [];
        public $actions;
        public function Manager() { return $this; }
        public function Actions() { return $this->actions; }
        protected function jsonParam($key) { return $this->params[$key] ?? null; }
        protected function jsonResponse($method, $data) { return $data; }
    }
}
namespace {
    require __DIR__ . '/../index.php';
    function check(bool $ok, string $label): void {
        if (!$ok) throw new \RuntimeException($label);
        echo "OK: $label\n";
    }
    $root = sys_get_temp_dir() . '/seguimiento-backend-' . bin2hex(random_bytes(8)) . '/';
    define('APP_PRIVATE_DATA', $root);
    $plugin = new \SeguimientoPlugin;
    $plugin->actions = new class {
        public bool $authenticated = true;
        public string $owner = 'owner-a';
        public string $active = 'account-a';
        public function model($hash) {
            return new class($hash) {
                public function __construct(private string $hash) {}
                public function Hash() { return $this->hash; }
                public function Email() { return $this->hash . '@example.invalid'; }
            };
        }
        public function getMainAccountFromToken() { return $this->authenticated ? $this->model($this->owner) : null; }
        public function getAccountFromToken() { return $this->authenticated ? $this->model($this->active) : null; }
    };
    try {
        check(\CorreoSeguimiento\Store::path() === $root . 'seguimiento/seguimiento.sqlite', 'portable private data path');
        putenv('SEGUIMIENTO_DB=' . $root . 'custom.sqlite');
        check(\CorreoSeguimiento\Store::path() === $root . 'custom.sqlite', 'explicit database override');
        putenv('SEGUIMIENTO_DB');
        $plugin->params = ['message_id' => '<test@example.invalid>', 'folder' => 'INBOX', 'uid' => 1,
            'subject' => 'Synthetic example', 'sender' => 'demo@example.invalid', 'state' => 'esperar',
            'due' => '2026-01-01', 'note' => 'Test only', 'owner' => 'owner-b', 'account' => 'account-b'];
        $saved = $plugin->SaveItem();
        check($saved['ok'], 'authenticated save');
        $id = $saved['item']['id'];
        $plugin->params = ['id' => $id];
        check(count($plugin->ListItems()['items']) === 1, 'browser owner/account cannot override session identity');
        $fresh = new \SeguimientoPlugin;
        $fresh->actions = $plugin->actions;
        check(count($fresh->ListItems()['items']) === 1, 'persistence across plugin instances');
        foreach (['owner', 'active'] as $field) {
            $original = $plugin->actions->$field;
            $plugin->actions->$field = 'different';
            check($plugin->ListItems()['items'] === [], 'other identity cannot list follow-ups');
            check(!$plugin->RemoveItem()['removed'], 'other identity cannot remove follow-up');
            check(!$plugin->LocateItem()['ok'], 'other identity cannot locate follow-up');
            $plugin->actions->$field = $original;
        }
        $plugin->actions->authenticated = false;
        foreach (['ListItems', 'SaveItem', 'LocateItem', 'RemoveItem'] as $method) {
            check(!$plugin->$method()['ok'], 'anonymous request rejected');
        }
        $plugin->actions->authenticated = true;
        $plugin->params = ['message_id' => '<bad@example.invalid>'];
        check(!$plugin->SaveItem()['ok'], 'invalid input rejected');
        $plugin->params = ['id' => $id];
        check($plugin->RemoveItem()['removed'], 'owner can remove follow-up');
        check($plugin->ListItems()['items'] === [], 'removal persists');
    } finally {
        putenv('SEGUIMIENTO_DB');
        foreach (glob($root . 'seguimiento/*') ?: [] as $file) unlink($file);
        if (is_dir($root . 'seguimiento')) rmdir($root . 'seguimiento');
        if (is_dir($root)) rmdir($root);
    }
}
