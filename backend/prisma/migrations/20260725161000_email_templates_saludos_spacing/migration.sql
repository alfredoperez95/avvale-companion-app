-- Juntar cierre del correo sin párrafo vacío entre medias.
-- También quitar el punto suelto tras {{yubiqA&amp;S}} y párrafos vacíos de más.

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '<p>Cualquier cosa comentamos,</p><p>¡Saludos!</p>',
  '<p>Cualquier cosa comentamos,<br>¡Saludos!</p>'
)
WHERE `content` LIKE '%<p>Cualquier cosa comentamos,</p><p>¡Saludos!</p>%';

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '{{yubiqA&amp;S}}.',
  '{{yubiqA&amp;S}}'
)
WHERE `content` LIKE '%{{yubiqA&amp;S}}.%';

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '<p>{{urlsEscaneadas}}</p><p></p><p>Cualquier cosa comentamos,',
  '<p>{{urlsEscaneadas}}</p><p>Cualquier cosa comentamos,'
)
WHERE `content` LIKE '%<p>{{urlsEscaneadas}}</p><p></p><p>Cualquier cosa comentamos,%';

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '<p>¡Saludos!</p><p></p><p></p><p></p><p></p><p></p>',
  '<p>¡Saludos!</p>'
)
WHERE `content` LIKE '%<p>¡Saludos!</p><p></p><p></p><p></p><p></p><p></p>%';

-- Variante si ya se unificó el cierre en un solo <p>
UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '<p>Cualquier cosa comentamos,<br>¡Saludos!</p><p></p><p></p><p></p><p></p><p></p>',
  '<p>Cualquier cosa comentamos,<br>¡Saludos!</p>'
)
WHERE `content` LIKE '%<p>Cualquier cosa comentamos,<br>¡Saludos!</p><p></p>%';
