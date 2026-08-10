<?php
declare(strict_types=1);

const APPLICATION_EMAIL = 'I@arammuradyan.ru';
const SENDER_EMAIL = 'website@outthedoor.ru';
const CONSENT_VERSION = 'personal-data-v1.3-2026-08-10';
const CONSENT_TEXT = 'Я даю оператору проекта «За дверью» — ИП Мурадяну Армену Мурадовичу — согласие на обработку указанных в анкете персональных данных, чтобы принять заявку, оценить спрос по дому и связаться со мной. Срок обработки — до завершения работы по заявке, но не более 12 месяцев с последнего содержательного взаимодействия. Отзыв: I@arammuradyan.ru.';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function field(string $name, int $maxLength, bool $required = true): string
{
    $value = trim((string) ($_POST[$name] ?? ''));
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';

    if ($required && $value === '') {
        respond(422, ['ok' => false, 'message' => 'Заполните все обязательные поля.']);
    }
    if (mb_strlen($value, 'UTF-8') > $maxLength) {
        respond(422, ['ok' => false, 'message' => 'Одно из полей заполнено слишком длинным текстом.']);
    }

    return $value;
}

$host = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')) ?? '');
if (!in_array($host, ['outthedoor.ru', 'www.outthedoor.ru'], true)) {
    respond(403, ['ok' => false, 'message' => 'Отправка разрешена только с сайта outthedoor.ru.']);
}

$liveFlag = __DIR__ . '/private/form-live.flag';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && (string) ($_GET['status'] ?? '') === '1') {
    respond(200, ['ok' => true, 'enabled' => is_file($liveFlag)]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'message' => 'Допускается только отправка формы.']);
}

if (!is_file($liveFlag)) {
    respond(503, [
        'ok' => false,
        'code' => 'not_live',
        'message' => 'Приём заявок пока не открыт.',
    ]);
}

// Скрытое поле должно оставаться пустым. Боту возвращается нейтральный успех без отправки письма.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    respond(200, ['ok' => true, 'message' => 'Заявка принята.']);
}

$name = field('name', 80);
$phone = field('phone', 30);
$city = field('city', 80);
$complex = field('complex', 120);
$address = field('address', 180);
$entrance = field('entrance', 40, false);
$slot = field('slot', 30);
$plan = field('plan', 80);
$source = field('source', 160, false) ?: 'прямой переход';
$clientConfirmedAt = field('client_confirmed_at', 60, false);
$consent = field('privacy_consent', 80);

if ($consent !== CONSENT_VERSION) {
    respond(422, ['ok' => false, 'message' => 'Необходимо подтвердить актуальную редакцию согласия.']);
}

$digits = preg_replace('/\D+/', '', $phone) ?? '';
if (strlen($digits) < 10 || strlen($digits) > 15) {
    respond(422, ['ok' => false, 'message' => 'Проверьте номер телефона.']);
}

$allowedSlots = ['07:00–09:00', '14:00–16:00', '20:00–22:00'];
if (!in_array($slot, $allowedSlots, true)) {
    respond(422, ['ok' => false, 'message' => 'Выберите время из списка.']);
}

$allowedPlans = ['Базовый — 792 ₽', 'Семейный — 1 390 ₽', 'Ежедневный — 2 490 ₽'];
if (!in_array($plan, $allowedPlans, true)) {
    respond(422, ['ok' => false, 'message' => 'Выберите тариф из списка.']);
}

$serverTime = new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow'));
$formId = bin2hex(random_bytes(8));
$remoteAddress = substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'не определён'), 0, 64);
$userAgent = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'не определён'), 0, 500);
$consentHash = hash('sha256', CONSENT_TEXT);

$body = implode("\n", [
    'ЗАЯВКА НА ПИЛОТ «ЗА ДВЕРЬЮ»',
    '',
    'Идентификатор формы: ' . $formId,
    'Получена сервером: ' . $serverTime->format('d.m.Y H:i:s T'),
    'Имя: ' . $name,
    'Телефон: ' . $phone,
    'Город: ' . $city,
    'ЖК: ' . $complex,
    'Адрес дома: ' . $address,
    'Подъезд/секция: ' . ($entrance !== '' ? $entrance : 'не указан'),
    'Удобное время: ' . $slot,
    'Предварительный тариф: ' . $plan,
    'Источник: ' . $source,
    '',
    'ДОКАЗАТЕЛЬСТВО СОГЛАСИЯ',
    'Согласие: дано активной отметкой перед отправкой формы',
    'Редакция: ' . CONSENT_VERSION,
    'Контрольная сумма текста SHA-256: ' . $consentHash,
    'Текст согласия: ' . CONSENT_TEXT,
    'Время подтверждения на устройстве: ' . ($clientConfirmedAt !== '' ? $clientConfirmedAt : 'не передано'),
    'Время получения сервером: ' . $serverTime->format(DateTimeInterface::ATOM),
    'Страница: https://outthedoor.ru/#reserve-form',
    'IP-адрес: ' . $remoteAddress,
    'Браузер: ' . $userAgent,
    '',
    'Срок хранения лида: не более 12 месяцев с последнего содержательного взаимодействия.',
    'Отзыв и обращения: ' . APPLICATION_EMAIL,
]);

$subjectText = '[За дверью #' . $formId . '] Новая заявка — ЖК ' . $complex;
$subject = mb_encode_mimeheader($subjectText, 'UTF-8', 'B', "\r\n");
$headers = [
    'From: ' . SENDER_EMAIL,
    'Reply-To: ' . APPLICATION_EMAIL,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Form-ID: ' . $formId,
    'X-Consent-Version: ' . CONSENT_VERSION,
];

$sent = function_exists('mail') && mail(APPLICATION_EMAIL, $subject, $body, implode("\r\n", $headers));
if (!$sent) {
    error_log('outthedoor_form_mail_failed form_id=' . $formId);
    respond(503, ['ok' => false, 'message' => 'Не удалось отправить заявку. Попробуйте ещё раз или напишите на I@arammuradyan.ru.']);
}

respond(200, [
    'ok' => true,
    'form_id' => $formId,
    'message' => 'Заявка отправлена. Мы свяжемся с вами после проверки возможности запуска в вашем доме.',
]);
