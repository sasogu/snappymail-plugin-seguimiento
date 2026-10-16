<?php
declare(strict_types=1);

require_once __DIR__ . '/Store.php';

class SeguimientoPlugin extends \RainLoop\Plugins\AbstractPlugin
{
    public const NAME = 'Seguimiento';
    public const AUTHOR = 'Samuel Soriano';
    public const VERSION = '0.1.9';
    public const RELEASE = '2026-10-16';
    public const REQUIRED = '2.38.2';
    public const CATEGORY = 'General';
    public const LICENSE = 'AGPL-3.0';
    public const DESCRIPTION = 'Pendientes, respuestas en espera, fechas de revisión y notas.';

    public function Init(): void
    {
        $this->addJs('seguimiento.js');
        $this->addCss('seguimiento.css');
        $this->addTemplate('templates/PopupsSeguimiento.html');
        $this->addJsonHook('SeguimientoList', 'ListItems');
        $this->addJsonHook('SeguimientoSave', 'SaveItem');
        $this->addJsonHook('SeguimientoLocate', 'LocateItem');
        $this->addJsonHook('SeguimientoRemove', 'RemoveItem');
    }

    private function context(): array
    {
        $actions = $this->Manager()->Actions();
        $account = $actions->getAccountFromToken();
        $owner = $actions->getMainAccountFromToken();
        if (!$account || !$owner) {
            throw new \RuntimeException('Se requiere una sesión de correo');
        }
        return [$owner->Hash(), $account->Hash(), $account];
    }

    private function result(string $method, callable $operation)
    {
        try {
            return $this->jsonResponse($method, ['ok' => true] + $operation());
        } catch (\InvalidArgumentException $error) {
            return $this->jsonResponse($method, ['ok' => false, 'error' => $error->getMessage()]);
        } catch (\Throwable $error) {
            return $this->jsonResponse($method, ['ok' => false,
                'error' => 'No se pudo completar la operación. Comprueba la sesión y la conexión.']);
        }
    }

    public function ListItems()
    {
        return $this->result(__FUNCTION__, function () {
            [$owner, $account, $model] = $this->context();
            $store = new \CorreoSeguimiento\Store(\CorreoSeguimiento\Store::path());
            return ['items' => $store->list($owner, $account), 'account' => $model->Email()];
        });
    }

    public function SaveItem()
    {
        return $this->result(__FUNCTION__, function () {
            [$owner, $account] = $this->context();
            $input = [];
            foreach (['message_id', 'folder', 'uid', 'subject', 'sender', 'state', 'due', 'note'] as $key) {
                $input[$key] = $this->jsonParam($key);
            }
            $store = new \CorreoSeguimiento\Store(\CorreoSeguimiento\Store::path());
            return ['item' => $store->save($owner, $account, $input)];
        });
    }

    public function LocateItem()
    {
        return $this->result(__FUNCTION__, function () {
            [$owner, $account, $model] = $this->context();
            $store = new \CorreoSeguimiento\Store(\CorreoSeguimiento\Store::path());
            $item = $store->find($owner, $account, (string)$this->jsonParam('id', ''));
            if (!$item) {
                throw new \InvalidArgumentException('No se encuentra este seguimiento en la cuenta actual');
            }
            $actions = $this->Manager()->Actions();
            $client = $actions->ImapClient();
            if (!$client->IsLoggined()) {
                $model->ImapConnectAndLogin($this->Manager(), $client, $actions->Config());
            }
            // Resolver por Message-ID evita abrir otro correo si los UID han cambiado.
            $uid = $actions->MailClient()->FindMessageUidByMessageId($item['folder'], $item['message_id']);
            if (!$uid) {
                throw new \InvalidArgumentException('El mensaje se ha movido o eliminado. Búscalo por su asunto y vuelve a guardar el seguimiento.');
            }
            return ['folder' => $item['folder'], 'uid' => $uid];
        });
    }

    public function RemoveItem()
    {
        return $this->result(__FUNCTION__, function () {
            [$owner, $account] = $this->context();
            $store = new \CorreoSeguimiento\Store(\CorreoSeguimiento\Store::path());
            return ['removed' => $store->remove($owner, $account, (string)$this->jsonParam('id', ''))];
        });
    }
}
