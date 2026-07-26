-- Añadir {{yubiqA&S}} tras {{contenidoAdministrativo}} en plantillas que aún no lo tienen.
-- En HTML se guarda &amp; para que TipTap/DOM no corrompan el shortcode.

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '{{contenidoAdministrativo}}',
  '{{contenidoAdministrativo}}<br>{{yubiqA&amp;S}}'
)
WHERE `content` LIKE '%{{contenidoAdministrativo}}%'
  AND `content` NOT LIKE '%{{yubiqA&amp;S}}%'
  AND `content` NOT LIKE '%{{yubiqA&S}}%';
