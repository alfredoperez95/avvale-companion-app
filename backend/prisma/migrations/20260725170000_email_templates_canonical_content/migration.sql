-- Alinear plantillas con el HTML canónico del cierre (Yubiq + urlsEscaneadas + firma).
-- Corrige copias personales/sistema que quedaron a medias tras migraciones previas o ediciones TipTap.

UPDATE `email_templates`
SET `content` = CONCAT(
  '<p>{{Saludo}},<br><br>',
  '¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br>',
  '<strong><em><br>@{{codigoOferta}}</em></strong></p>',
  '<p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p>',
  '<p>Marcado WON en Hubspot, link oportunidad:</p>',
  '<p>{{urlHubSpot}}</p>',
  '<p>&nbsp;</p>',
  '<p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p>',
  '<p>{{contenidoAdministrativo}}<br>{{yubiqA&amp;S}}{{urlsEscaneadas}}<br><br>',
  'Cualquier cosa comentamos,<br>¡Saludos!</p>'
)
WHERE
  `content` LIKE '%{{yubiqA&amp;S}}</p>%Cualquier cosa%'
  OR `content` LIKE '%Cualquier cosa comentamos,<br></p>%¡Saludos!%'
  OR `content` LIKE '%Cualquier cosa comentamos,</p><p></p><p>¡Saludos!%'
  OR `content` LIKE '%Cualquier cosa comentamos,</p><p>¡Saludos!%'
  OR (
    `user_id` IS NULL
    AND (
      `content` NOT LIKE '%{{yubiqA&amp;S}}{{urlsEscaneadas}}%'
      OR `content` NOT LIKE '%Cualquier cosa comentamos,<br>¡Saludos!</p>'
    )
  );

-- Si el catálogo de sistema no tiene las dos plantillas estándar, crearlas.
INSERT INTO `email_templates` (`id`, `name`, `content`, `user_id`, `created_at`)
SELECT
  UUID(),
  'Activación Estándar - Consultoria',
  CONCAT(
    '<p>{{Saludo}},<br><br>',
    '¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br>',
    '<strong><em><br>@{{codigoOferta}}</em></strong></p>',
    '<p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p>',
    '<p>Marcado WON en Hubspot, link oportunidad:</p>',
    '<p>{{urlHubSpot}}</p>',
    '<p>&nbsp;</p>',
    '<p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p>',
    '<p>{{contenidoAdministrativo}}<br>{{yubiqA&amp;S}}{{urlsEscaneadas}}<br><br>',
    'Cualquier cosa comentamos,<br>¡Saludos!</p>'
  ),
  NULL,
  NOW(3)
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `email_templates`
  WHERE `user_id` IS NULL AND `name` = 'Activación Estándar - Consultoria'
);

INSERT INTO `email_templates` (`id`, `name`, `content`, `user_id`, `created_at`)
SELECT
  UUID(),
  'Activación Estándar - Software',
  CONCAT(
    '<p>{{Saludo}},<br><br>',
    '¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br>',
    '<strong><em><br>@{{codigoOferta}}</em></strong></p>',
    '<p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p>',
    '<p>Marcado WON en Hubspot, link oportunidad:</p>',
    '<p>{{urlHubSpot}}</p>',
    '<p>&nbsp;</p>',
    '<p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p>',
    '<p>{{contenidoAdministrativo}}<br>{{yubiqA&amp;S}}{{urlsEscaneadas}}<br><br>',
    'Cualquier cosa comentamos,<br>¡Saludos!</p>'
  ),
  NULL,
  NOW(3)
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `email_templates`
  WHERE `user_id` IS NULL AND `name` = 'Activación Estándar - Software'
);
