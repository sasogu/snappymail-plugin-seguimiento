<?php
declare(strict_types=1);

namespace CorreoSeguimiento;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use PDO;

final class Store
{
    private PDO $db;
    public const STATES = ['responder', 'esperar', 'resuelto'];

    public function __construct(string $path)
    {
        if ($path !== ':memory:') {
            $directory = dirname($path);
            if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
                throw new \RuntimeException('No se puede preparar el almacenamiento');
            }
        }
        $this->db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $this->db->exec('PRAGMA busy_timeout = 5000');
        $this->db->exec('PRAGMA journal_mode = WAL');
        $this->db->exec('CREATE TABLE IF NOT EXISTS followups (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, account TEXT NOT NULL,
            message_id TEXT NOT NULL, folder TEXT NOT NULL, uid INTEGER NOT NULL,
            subject TEXT NOT NULL, sender TEXT NOT NULL, state TEXT NOT NULL,
            due TEXT NOT NULL, note TEXT NOT NULL, updated TEXT NOT NULL,
            overdue INTEGER NOT NULL DEFAULT 0,
            UNIQUE(owner, account, message_id)
        )');
        $this->db->exec('CREATE INDEX IF NOT EXISTS followups_account ON followups(owner, account, state, due)');
        if ($path !== ':memory:') {
            chmod($path, 0600);
        }
    }

    public static function path(): string
    {
        $override = getenv('SEGUIMIENTO_DB');
        if ($override) return $override;
        if (!defined('APP_PRIVATE_DATA')) throw new \RuntimeException('Configure SEGUIMIENTO_DB for CLI use');
        return APP_PRIVATE_DATA . 'seguimiento/seguimiento.sqlite';
    }

    private static function text(mixed $value, int $limit, bool $required = false): string
    {
        if (!is_string($value) || mb_strlen($value) > $limit || str_contains($value, "\0")) {
            throw new InvalidArgumentException('Texto no válido o demasiado largo');
        }
        $value = trim($value);
        if ($required && $value === '') {
            throw new InvalidArgumentException('Falta un dato obligatorio');
        }
        return $value;
    }

    public function save(string $owner, string $account, array $input): array
    {
        $messageId = self::text($input['message_id'] ?? '', 998, true);
        $bareId = trim($messageId, '<>');
        if ($bareId === '' || preg_match('/[\s<>"\\\\()]/u', $bareId)) {
            throw new InvalidArgumentException('Message-ID no válido');
        }
        $messageId = '<' . $bareId . '>';
        $folder = self::text($input['folder'] ?? '', 1024, true);
        $uid = filter_var($input['uid'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($uid === false) {
            throw new InvalidArgumentException('Identificador IMAP no válido');
        }
        $state = $input['state'] ?? '';
        if (!in_array($state, self::STATES, true)) {
            throw new InvalidArgumentException('Estado no válido');
        }
        $due = self::text($input['due'] ?? '', 10);
        if ($due !== '') {
            $date = DateTimeImmutable::createFromFormat('!Y-m-d', $due);
            if (!$date || $date->format('Y-m-d') !== $due) {
                throw new InvalidArgumentException('Fecha de revisión no válida');
            }
        }
        $row = [
            'id' => hash('sha256', json_encode([$owner, $account, $messageId], JSON_THROW_ON_ERROR)),
            'owner' => $owner, 'account' => $account, 'message_id' => $messageId,
            'folder' => $folder, 'uid' => $uid,
            'subject' => self::text($input['subject'] ?? '', 1000),
            'sender' => self::text($input['sender'] ?? '', 1000),
            'state' => $state, 'due' => $due,
            'note' => self::text($input['note'] ?? '', 2000),
            'updated' => gmdate('c'),
            'overdue' => (int)($state !== 'resuelto' && $due !== '' && $due <= self::today()),
        ];
        $sql = 'INSERT INTO followups (' . implode(',', array_keys($row)) . ') VALUES (:'
            . implode(',:', array_keys($row)) . ') ON CONFLICT(id) DO UPDATE SET
            folder=excluded.folder, uid=excluded.uid, subject=excluded.subject,
            sender=excluded.sender, state=excluded.state, due=excluded.due,
            note=excluded.note, updated=excluded.updated, overdue=excluded.overdue';
        $this->db->prepare($sql)->execute($row);
        unset($row['owner'], $row['account']);
        return $row;
    }

    public static function today(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone(getenv('SEGUIMIENTO_TIMEZONE') ?: 'Europe/Madrid')))->format('Y-m-d');
    }

    public function refreshDue(?string $today = null): int
    {
        $query = $this->db->prepare("UPDATE followups SET overdue =
            CASE WHEN state != 'resuelto' AND due != '' AND due <= :today THEN 1 ELSE 0 END");
        $query->execute(['today' => $today ?? self::today()]);
        return (int)$this->db->query('SELECT COUNT(*) FROM followups WHERE overdue=1')->fetchColumn();
    }

    public function list(string $owner, string $account): array
    {
        $this->refreshDue();
        $query = $this->db->prepare('SELECT id,message_id,folder,uid,subject,sender,state,due,note,updated,overdue
            FROM followups WHERE owner=:owner AND account=:account
            ORDER BY (state=\'resuelto\') ASC, overdue DESC, (due=\'\') ASC, due ASC, updated DESC');
        $query->execute(['owner' => $owner, 'account' => $account]);
        return $query->fetchAll(PDO::FETCH_ASSOC);
    }

    public function find(string $owner, string $account, string $id): ?array
    {
        $query = $this->db->prepare('SELECT * FROM followups WHERE id=:id AND owner=:owner AND account=:account');
        $query->execute(['id' => $id, 'owner' => $owner, 'account' => $account]);
        return $query->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function remove(string $owner, string $account, string $id): bool
    {
        $query = $this->db->prepare('DELETE FROM followups WHERE id=:id AND owner=:owner AND account=:account');
        $query->execute(['id' => $id, 'owner' => $owner, 'account' => $account]);
        return $query->rowCount() === 1;
    }
}
