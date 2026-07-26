-- Unificar Yubiq + cierre en el mismo <p> (una sola línea en blanco antes del cierre)
-- y dejar {{urlsEscaneadas}} sin <p> propio (si está vacío no genera hueco).
-- Limpiar <p></p> sobrantes al final.

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '{{yubiqA&amp;S}}</p><p>{{urlsEscaneadas}}</p><p>Cualquier cosa comentamos,<br>¡Saludos!</p>',
  '{{yubiqA&amp;S}}{{urlsEscaneadas}}<br><br>Cualquier cosa comentamos,<br>¡Saludos!</p>'
)
WHERE `content` LIKE '%{{yubiqA&amp;S}}</p><p>{{urlsEscaneadas}}</p><p>Cualquier cosa comentamos,%';

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '{{yubiqA&amp;S}}</p><p>{{urlsEscaneadas}}</p><p>Cualquier cosa comentamos,</p><p>¡Saludos!</p>',
  '{{yubiqA&amp;S}}{{urlsEscaneadas}}<br><br>Cualquier cosa comentamos,<br>¡Saludos!</p>'
)
WHERE `content` LIKE '%{{yubiqA&amp;S}}</p><p>{{urlsEscaneadas}}</p><p>Cualquier cosa comentamos,</p><p>¡Saludos!</p>%';

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  '<p>Cualquier cosa comentamos,<br>¡Saludos!</p><p></p><p></p><p></p><p></p>',
  '<p>Cualquier cosa comentamos,<br>¡Saludos!</p>'
)
WHERE `content` LIKE '%<p>Cualquier cosa comentamos,<br>¡Saludos!</p><p></p>%';

UPDATE `email_templates`
SET `content` = REPLACE(
  `content`,
  'Cualquier cosa comentamos,<br>¡Saludos!</p><p></p><p></p><p></p><p></p>',
  'Cualquier cosa comentamos,<br>¡Saludos!</p>'
)
WHERE `content` LIKE '%Cualquier cosa comentamos,<br>¡Saludos!</p><p></p>%';
