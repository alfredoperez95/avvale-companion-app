/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-12.2.2-MariaDB, for osx10.21 (arm64)
--
-- Host: 212.227.22.75    Database: default
-- ------------------------------------------------------
-- Server version	11.8.6-MariaDB-ubu2404

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES
('0e8558fe-ab63-448a-bb95-94ccc64bd3ac','267a2a8943fbb7fc434f2c499c00b522aa79d29c2b4b29f921985c6e82ee64e1','2026-03-24 21:09:26.375','20260324100000_user_scoped_config',NULL,NULL,'2026-03-24 21:09:26.098',1),
('24d392f8-75b0-4c23-8469-afd43b38f2dc','44c9dc259725cb2ad46d8dda2b8c1fc5fa5c96e5f6d205e40659f4d021f91234','2026-03-13 12:05:10.726','20250321000000_cc_contacts',NULL,NULL,'2026-03-13 12:05:10.397',1),
('24d68cc6-2b57-4f89-9896-3872511d9a4f','1ed0477f0252b2a8797bb04a4631d84c9a6bce588ce336491ea1ee55fb06fffa','2026-03-13 09:39:34.596','20250316000000_areas_and_activation_areas',NULL,NULL,'2026-03-13 09:39:34.258',1),
('2f508366-b093-49c7-9c89-0ed069a7fc73','55120f2573763eb7b497469b9ffbfd80c22fe1db5ef43bc88d12a30c7856c152','2026-03-13 08:10:07.898','20250314000000_add_user_profile_fields',NULL,NULL,'2026-03-13 08:10:07.468',1),
('31d53014-e292-4c25-a347-4f12a54d4eb2','e26290f09401084bbf26d9261eff8f656ccd068071bf04c83786e0be9f8fb5b5','2026-03-23 16:34:07.179','20260323000000_attachment_public_outbox',NULL,NULL,'2026-03-23 16:34:06.963',1),
('43fe25f6-4989-4cbd-8c25-d39cca936a26','c53588e93669fbf2d52e20d2488ff697c9f3abe15313aaabe2e31be6a580d7af','2026-03-13 12:59:46.548','20250323000000_activation_project_amount_and_type',NULL,NULL,'2026-03-13 12:59:46.228',1),
('4ed38c61-0c65-4b0e-af51-f69f2789b620','d7f8ece8f5093fd764fecf6d951f38a38e0e904e1bc57124d7e2f791cece41be','2026-03-15 11:38:23.838','20250326100000_seed_billing_admin_contacts',NULL,NULL,'2026-03-15 11:38:23.585',1),
('65e973ba-c01c-4249-aadf-691858ab765f','384721947a8b5d2093a33fe315c9e5964001e7c6852b65b819d4bcc54c18e9b3','2026-03-13 09:50:29.772','20250317000000_set_all_users_admin',NULL,NULL,'2026-03-13 09:50:29.464',1),
('6fb4d5c3-46bf-43f8-a61d-695e81d1bd3b','c9cf8f59aa2de109a53e5e1b0f7ab3894eb75cc326ef22f07ecd1f657b418060','2026-03-13 07:46:30.253','20250313000000_add_client',NULL,NULL,'2026-03-13 07:46:30.024',1),
('75839c27-b7fb-43bc-b090-da3db94fc150','f98816583bd961fc03b345726e9aa13fb8a1a59ffcf5c7c259c164eb05156ef2','2026-03-24 05:37:30.751','20260323110000_project_jp_fields',NULL,NULL,'2026-03-24 05:37:30.425',1),
('7a4d0f25-1e51-46ff-8ee9-d9adfda17dea','e4cdc7f34cde08dfc5044944d3502336dcb825a5bc95a5b6f98a4da2fe643555','2026-03-13 10:16:14.195','20250319000000_activation_sub_areas',NULL,NULL,'2026-03-13 10:16:13.810',1),
('8c0c9fd5-1406-4589-bd2e-4067c3126c00','be4712a9fad4b42bf6db2a2e31e25d71c4a06e17503ac859dbdc81da78a5fc58','2026-03-13 14:35:54.758','20250324000000_activation_attachments',NULL,NULL,'2026-03-13 14:35:54.438',1),
('8df1cb47-2ece-4919-836e-4a5100ace546','52dbbed74130beb0596eff3480411a6cd7db74f38d6f7dee6c83b5db63b885d4','2026-03-21 10:49:30.604','20250328000000_add_activation_number',NULL,NULL,'2026-03-21 10:49:30.187',1),
('95658989-47f7-4f38-87b6-7f186d333c7f','c21ae02fc5af261d59ee77b0cf0039c6cf94f5f09e6db3bda0b54fc4df7eb741','2026-03-13 10:04:32.113','20250318000000_area_subarea_structure',NULL,NULL,'2026-03-13 10:04:31.837',1),
('95d60990-4cd0-437c-8f77-257c30dbd291','52e15985c55b97f0b7843a133219b44268e713f7706b766adb14ca789ec77517','2026-03-16 18:04:14.166','20250327000000_add_user_enabled',NULL,NULL,'2026-03-16 18:04:13.085',1),
('9b558d20-4431-4de5-848d-1e3a138b152c','f8d1d71ae104796d7a45314fe42014faf5fe5fb2b1f67eee85ae4e4f062b71bf','2026-03-13 07:46:29.929','20250312000000_add_body_and_attachments',NULL,NULL,'2026-03-13 07:46:29.687',1),
('9c48508f-54b1-4cd8-904f-e62727c87053','9fe098b02dd8e450d275edfaaf70814f4c4a9b066feef05e0bbc755b321f75a8','2026-03-21 12:26:28.583','20250329000000_add_email_signature',NULL,NULL,'2026-03-21 12:26:28.247',1),
('9c6ffe83-e1f4-4066-b2cc-9e76a5bae938','6d95e11a17296fcaad083b52ad19ba8ba5af09e3a9bfaa820b1d0fd26f45d977','2026-03-12 12:31:16.101','20250311000000_init',NULL,NULL,'2026-03-12 12:31:15.866',1),
('c2ba57ae-9aa3-4d84-b07e-94c8b9c15a7f','3317de18c588fa8007a36c77ce275f12d7e4874ad6c7cd23364e7bec903162eb','2026-03-15 11:35:09.441','20250326000000_add_billing_admin_contacts',NULL,NULL,'2026-03-15 11:35:09.125',1),
('cb92119a-6297-4323-9c49-89c44cd71c36','c6aad04aae41e1c68ae03948598b1efab7d5aa828207daa3d335863c9f5cf51b','2026-03-13 12:05:10.968','20250322000000_seed_cc_contacts_avvale',NULL,NULL,'2026-03-13 12:05:10.822',1),
('e96470b3-e2e6-461b-8fb5-4ca691dce6b2','5219634c669505128cabed4c3f5ff7c227d77465c51c6e6d2e946585c7640d8f','2026-03-13 08:23:35.810','20250315000000_add_user_appearance',NULL,NULL,'2026-03-13 08:23:35.519',1),
('f2b100aa-fba5-44e5-aaa3-2f2c1d0f19a6','46f4a6a2f09d00be14e85a74f1865410fd36703fc9627693d0ce2d100774f18b','2026-03-14 09:15:58.238','20250325000000_attachment_names',NULL,NULL,'2026-03-14 09:15:57.991',1),
('f88171da-74cf-4a6b-a64f-0848dbd83e19','da0de37739d121921b47e45e23a6930563430d12b013343bd4c21aba57dfc685','2026-03-13 11:47:58.972','20250320000000_recipient_to_text',NULL,NULL,'2026-03-13 11:47:58.655',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `activation_areas`
--

DROP TABLE IF EXISTS `activation_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activation_areas` (
  `activation_id` varchar(191) NOT NULL,
  `area_id` varchar(191) NOT NULL,
  PRIMARY KEY (`activation_id`,`area_id`),
  KEY `activation_areas_area_id_fkey` (`area_id`),
  CONSTRAINT `activation_areas_activation_id_fkey` FOREIGN KEY (`activation_id`) REFERENCES `activations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `activation_areas_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activation_areas`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `activation_areas` WRITE;
/*!40000 ALTER TABLE `activation_areas` DISABLE KEYS */;
/*!40000 ALTER TABLE `activation_areas` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `activation_attachments`
--

DROP TABLE IF EXISTS `activation_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activation_attachments` (
  `id` varchar(191) NOT NULL,
  `activation_id` varchar(191) NOT NULL,
  `original_url` text NOT NULL,
  `stored_path` varchar(191) NOT NULL,
  `file_name` varchar(191) NOT NULL,
  `content_type` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `public_token` varchar(191) DEFAULT NULL,
  `public_expires_at` datetime(3) DEFAULT NULL,
  `published_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activation_attachments_public_token_key` (`public_token`),
  KEY `activation_attachments_activation_id_fkey` (`activation_id`),
  CONSTRAINT `activation_attachments_activation_id_fkey` FOREIGN KEY (`activation_id`) REFERENCES `activations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activation_attachments`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `activation_attachments` WRITE;
/*!40000 ALTER TABLE `activation_attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `activation_attachments` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `activation_sub_areas`
--

DROP TABLE IF EXISTS `activation_sub_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activation_sub_areas` (
  `activation_id` varchar(191) NOT NULL,
  `sub_area_id` varchar(191) NOT NULL,
  PRIMARY KEY (`activation_id`,`sub_area_id`),
  KEY `activation_sub_areas_sub_area_id_fkey` (`sub_area_id`),
  CONSTRAINT `activation_sub_areas_activation_id_fkey` FOREIGN KEY (`activation_id`) REFERENCES `activations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `activation_sub_areas_sub_area_id_fkey` FOREIGN KEY (`sub_area_id`) REFERENCES `sub_areas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activation_sub_areas`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `activation_sub_areas` WRITE;
/*!40000 ALTER TABLE `activation_sub_areas` DISABLE KEYS */;
/*!40000 ALTER TABLE `activation_sub_areas` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `activations`
--

DROP TABLE IF EXISTS `activations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `activations` (
  `id` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` varchar(191) NOT NULL,
  `created_by_user_id` varchar(191) NOT NULL,
  `status` enum('DRAFT','READY_TO_SEND','SENT','ERROR') NOT NULL DEFAULT 'DRAFT',
  `recipient_to` text NOT NULL,
  `recipient_cc` text DEFAULT NULL,
  `subject` varchar(191) NOT NULL,
  `project_name` varchar(191) NOT NULL,
  `offer_code` varchar(191) NOT NULL,
  `hubspot_url` varchar(191) DEFAULT NULL,
  `make_sent_at` datetime(3) DEFAULT NULL,
  `make_run_id` varchar(191) DEFAULT NULL,
  `error_message` varchar(191) DEFAULT NULL,
  `last_status_at` datetime(3) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `attachment_urls` text DEFAULT NULL,
  `client` varchar(191) DEFAULT NULL,
  `project_amount` varchar(191) DEFAULT NULL,
  `project_type` enum('CONSULTORIA','SW') DEFAULT NULL,
  `attachment_names` text DEFAULT NULL,
  `activation_number` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_jp_name` varchar(191) DEFAULT NULL,
  `project_jp_email` varchar(191) DEFAULT NULL,
  `project_jp_source` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `activations_activation_number_key` (`activation_number`),
  KEY `activations_created_by_user_id_idx` (`created_by_user_id`),
  CONSTRAINT `activations_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activations`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `activations` WRITE;
/*!40000 ALTER TABLE `activations` DISABLE KEYS */;
/*!40000 ALTER TABLE `activations` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `areas`
--

DROP TABLE IF EXISTS `areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `areas` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `director_name` varchar(191) DEFAULT NULL,
  `director_email` varchar(191) DEFAULT NULL,
  `owner_user_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `areas_owner_user_id_idx` (`owner_user_id`),
  CONSTRAINT `areas_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areas`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `areas` WRITE;
/*!40000 ALTER TABLE `areas` DISABLE KEYS */;
INSERT INTO `areas` VALUES
('0105febf-8cd5-4bdb-a649-7ee2329c162a','SAIBORG','2026-03-24 21:09:54.684','Luis Zarzo','luis.zarzo@avvale.com','6804f869-1f25-4cb1-8ef8-bd8583657e5f'),
('07bb8453-1227-43ab-80f5-ace448056bc1','PULSE RUN','2026-03-24 21:09:57.971','Javier Martinez Llaguno','javier.llaguno@avvale.com','6804f869-1f25-4cb1-8ef8-bd8583657e5f'),
('0897e0d6-6409-4cad-aede-ba371e71d44b','PULSE RUN','2026-03-13 10:30:59.863','Javier Martinez Llaguno','javier.llaguno@avvale.com',NULL),
('32caa81b-1cdc-470a-8bfb-a0a883887e2f','YUBIQ','2026-03-24 21:10:00.020','Giovanny Buitrago','giovanny.buitrago@avvale.com','6804f869-1f25-4cb1-8ef8-bd8583657e5f'),
('4505be87-60fc-4d98-b907-b6ebef6449a2','YUBIQ','2026-03-24 21:15:10.565','Giovanny Buitrago','giovanny.buitrago@avvale.com','d565e282-a081-4baa-918e-87a1a0b01ca1'),
('81eef10a-5bd5-46c5-9dce-d1fc13fe86c5','PULSE GROW','2026-03-24 08:40:53.590','Jose Manuel Romero','josemanuel.romero@avvale.com',NULL),
('86bb15fb-1b16-4c59-acf9-0f72f45ba3df','SAIBORG','2026-03-13 10:06:31.122','Luis Zarzo','luis.zarzo@avvale.com',NULL),
('9cd8636a-2030-4a33-a25b-88d8c8ec5f77','SAIBORG','2026-03-24 21:15:04.602','Luis Zarzo','luis.zarzo@avvale.com','d565e282-a081-4baa-918e-87a1a0b01ca1'),
('9fc5b003-2fc3-4601-835e-e65eb8396721','WISE','2026-03-24 08:39:56.676','Jose Manuel Prieto','josemanuel.prieto@avvale.com',NULL),
('bf9f4c3a-5319-46f6-8059-13ab43e11242','PULSE GROW','2026-03-24 21:10:01.357','Jose Manuel Romero','josemanuel.romero@avvale.com','6804f869-1f25-4cb1-8ef8-bd8583657e5f'),
('c47de9c2-148e-40a1-80ea-7143e9d0b82a','YUBIQ','2026-03-24 08:38:09.144','Giovanny Buitrago','giovanny.buitrago@avvale.com',NULL),
('c7a4028e-5ff5-4713-9306-4f1f4265c608','PULSE RUN','2026-03-24 21:15:08.375','Javier Martinez Llaguno','javier.llaguno@avvale.com','d565e282-a081-4baa-918e-87a1a0b01ca1'),
('d704fd01-b977-4106-bf9c-c6c9b86f0ba5','WISE','2026-03-24 21:15:11.243','Jose Manuel Prieto','josemanuel.prieto@avvale.com','d565e282-a081-4baa-918e-87a1a0b01ca1'),
('d844940e-8fba-41f8-bb62-7d69a55a8e49','PULSE GROW','2026-03-24 21:15:11.993','Jose Manuel Romero','josemanuel.romero@avvale.com','d565e282-a081-4baa-918e-87a1a0b01ca1'),
('f3894bdc-f239-4710-a389-18f5a21525a9','WISE','2026-03-24 21:10:00.734','Jose Manuel Prieto','josemanuel.prieto@avvale.com','6804f869-1f25-4cb1-8ef8-bd8583657e5f');
/*!40000 ALTER TABLE `areas` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `billing_admin_contacts`
--

DROP TABLE IF EXISTS `billing_admin_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `billing_admin_contacts` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `billing_admin_contacts`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `billing_admin_contacts` WRITE;
/*!40000 ALTER TABLE `billing_admin_contacts` DISABLE KEYS */;
INSERT INTO `billing_admin_contacts` VALUES
('797d1d8b-2063-11f1-9e86-02420a00010d','Avvale Facturacion Es','avvale-facturacion.es@avvale.com','2026-03-15 11:38:23.728'),
('797d2074-2063-11f1-9e86-02420a00010d','Marta Aguirre Martin','marta.aguirre@avvale.com','2026-03-15 11:38:23.728'),
('797d214c-2063-11f1-9e86-02420a00010d','Valeria Valencia','valeria.valencia@avvale.com','2026-03-15 11:38:23.728'),
('797d2197-2063-11f1-9e86-02420a00010d','Lidia Vicente Castillo','lidia.vicente@avvale.com','2026-03-15 11:38:23.728'),
('797d21b4-2063-11f1-9e86-02420a00010d','Alejandra Vazquez Dominguez','alejandra.vazquez@avvale.com','2026-03-15 11:38:23.728'),
('797d21cb-2063-11f1-9e86-02420a00010d','Evelyn Lora','evelyn.lora@avvale.com','2026-03-15 11:38:23.728'),
('797d21df-2063-11f1-9e86-02420a00010d','Leonor Uzcategui Rojas','leonor.uzcategui@avvale.com','2026-03-15 11:38:23.728'),
('797d21ef-2063-11f1-9e86-02420a00010d','Morella Santoro','morella.santoro@avvale.com','2026-03-15 11:38:23.728'),
('797d2206-2063-11f1-9e86-02420a00010d','Patricia Isabel Mendez Casillas','patricia.mendez@avvale.com','2026-03-15 11:38:23.728');
/*!40000 ALTER TABLE `billing_admin_contacts` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `cc_contacts`
--

DROP TABLE IF EXISTS `cc_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cc_contacts` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `is_project_jp` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cc_contacts`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `cc_contacts` WRITE;
/*!40000 ALTER TABLE `cc_contacts` DISABLE KEYS */;
INSERT INTO `cc_contacts` VALUES
('17cf5af1-e82b-4bc0-b77f-9aac46791dae','Juan Carlos Gago','juancarlos.gago@avvale.com','2026-03-24 17:27:57.932',0),
('83055c4a-66f9-4800-8462-390039c5ca12','Ricardo Eusse Sanchez','ricardo.eusse@avvale.com','2026-03-24 17:32:42.194',0),
('957b8eac-b843-4ba3-a7ba-f596160f5ee6','Raquel Nuño','raquel.nuno@avvale.com','2026-03-24 17:29:31.181',0),
('ade596fc-886e-43e4-b2cf-37c2d10dd9f8','Estefania García','estefania.garcia@avvale.com','2026-03-24 17:28:53.865',0),
('bf030b45-34e3-4eee-9a12-6dcfc29f2871','Ricardo Ortiz','ricardo.ortiz@avvale.com','2026-03-24 17:32:41.837',0),
('d7a8a1eb-5a86-423d-af94-1e3411f77d04','Jesus Alberto Ortiz','jesusalberto.ortiz@avvale.com','2026-03-24 17:32:42.715',0),
('e29e7eae-1ed4-11f1-9e86-02420a00010d','Agustin Figueredo','agustin.figueredo@avvale.com','2026-03-13 12:05:10.913',0),
('e29e7fed-1ed4-11f1-9e86-02420a00010d','Aitor Sanchez','aitor.sanchez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8002-1ed4-11f1-9e86-02420a00010d','Alejandra Castedo','alejandra.castedo@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8014-1ed4-11f1-9e86-02420a00010d','Alfredo Perez','alfredo.perez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e801f-1ed4-11f1-9e86-02420a00010d','Alvaro Arbaiza','alvaro.arbaiza@avvale.com','2026-03-13 12:05:10.913',0),
('e29e802b-1ed4-11f1-9e86-02420a00010d','Antonio Guzman','antonio.guzman@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8036-1ed4-11f1-9e86-02420a00010d','Antonio Sanz','antonio.sanz@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8041-1ed4-11f1-9e86-02420a00010d','Daniel Marchante','daniel.marchante@avvale.com','2026-03-13 12:05:10.913',0),
('e29e804b-1ed4-11f1-9e86-02420a00010d','Daniela Gonzalez','daniela.gonzalez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8056-1ed4-11f1-9e86-02420a00010d','David Gonzalez Pacheco','david.gonzalezp@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8060-1ed4-11f1-9e86-02420a00010d','David Orozco Villarrubia','david.orozco@avvale.com','2026-03-13 12:05:10.913',0),
('e29e806a-1ed4-11f1-9e86-02420a00010d','David Rodriguez-Barba Jimenez','david.rodriguezb@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8076-1ed4-11f1-9e86-02420a00010d','Dionisio Garcia','dionisio.garcia@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8081-1ed4-11f1-9e86-02420a00010d','Enrique Stampa García-Ormaechea','enrique.stampa@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8090-1ed4-11f1-9e86-02420a00010d','Enrique Torres Barrasa','enrique.torres@avvale.com','2026-03-13 12:05:10.913',0),
('e29e809c-1ed4-11f1-9e86-02420a00010d','Fabio Caroli','fabio.caroli@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80a5-1ed4-11f1-9e86-02420a00010d','Francisco Javier Lopez Crespo','javier.lopez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80b0-1ed4-11f1-9e86-02420a00010d','Gerard Prats Ramirez','gerard.prats@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80bb-1ed4-11f1-9e86-02420a00010d','Giovanny Buitrago','giovanny.buitrago@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80c6-1ed4-11f1-9e86-02420a00010d','Guillermo Truan','guillermo.truan@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80d0-1ed4-11f1-9e86-02420a00010d','Ignacio Hidalgo Pitto','ignacio.hidalgo@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80da-1ed4-11f1-9e86-02420a00010d','Irene Dieguez','irene.dieguez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80e4-1ed4-11f1-9e86-02420a00010d','Isabella Josefina Santoro Lombardo','isabella.santoro@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80ee-1ed4-11f1-9e86-02420a00010d','Ismael Bermejo Jimenez','ismael.bermejo@avvale.com','2026-03-13 12:05:10.913',0),
('e29e80f7-1ed4-11f1-9e86-02420a00010d','Javier Arozarena Garcia','javier.arozarena@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8100-1ed4-11f1-9e86-02420a00010d','Javier Martinez Llaguno','javier.llaguno@avvale.com','2026-03-13 12:05:10.913',0),
('e29e815b-1ed4-11f1-9e86-02420a00010d','Joanandreu Blade','joanandreu.blade@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8167-1ed4-11f1-9e86-02420a00010d','Jose Javier Rigal Martinez','javier.rigal@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8170-1ed4-11f1-9e86-02420a00010d','Jose Manuel Nieto Navarro','josemanuel.nieto@avvale.com','2026-03-13 12:05:10.913',0),
('e29e817a-1ed4-11f1-9e86-02420a00010d','José Manuel Prieto Sanz','josemanuel.prieto@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8184-1ed4-11f1-9e86-02420a00010d','Jose Manuel Romero Martinez','josemanuel.romero@avvale.com','2026-03-13 12:05:10.913',0),
('e29e818e-1ed4-11f1-9e86-02420a00010d','Jose Ramon Dominguez Rodriguez','joseramon.dominguez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8199-1ed4-11f1-9e86-02420a00010d','Juan Carlos Fuentes Rubio','juancarlos.fuentes@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81a3-1ed4-11f1-9e86-02420a00010d','Juan Carlos Vidaller Lasierra','juancarlos.vidaller@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81ad-1ed4-11f1-9e86-02420a00010d','Juan Pablo Guichon','juanpablo.guichon@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81b6-1ed4-11f1-9e86-02420a00010d','Luis Zarzo Fuertes','luis.zarzo@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81c1-1ed4-11f1-9e86-02420a00010d','Manuel Angel Garcia Sanchez','manuelangel.garcia@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81ca-1ed4-11f1-9e86-02420a00010d','Manuel Jesús Pacheco Ibáñez','manuel.pacheco@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81d4-1ed4-11f1-9e86-02420a00010d','Manuel Torres Brabo','manuel.torres@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81de-1ed4-11f1-9e86-02420a00010d','Marc Pla Simon','marc.pla@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81e7-1ed4-11f1-9e86-02420a00010d','Maria Gonzalez Abarca','maria.gonzalez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81f1-1ed4-11f1-9e86-02420a00010d','Mario Cortes Flores','mario.cortesf@avvale.com','2026-03-13 12:05:10.913',0),
('e29e81fb-1ed4-11f1-9e86-02420a00010d','Mario Morillo Molinuevo','mario.morillo@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8204-1ed4-11f1-9e86-02420a00010d','Oscar Garcia Garcia','oscar.garcia@avvale.com','2026-03-13 12:05:10.913',0),
('e29e820e-1ed4-11f1-9e86-02420a00010d','Pablo Virseda','pablo.virseda@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8218-1ed4-11f1-9e86-02420a00010d','Rafael Garcia Montserrat','rafael.garcia@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8221-1ed4-11f1-9e86-02420a00010d','Raquel Mera Manteca','raquel.mera@avvale.com','2026-03-13 12:05:10.913',0),
('e29e822c-1ed4-11f1-9e86-02420a00010d','Roberto Fernandez Revilla','roberto.fernandez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8236-1ed4-11f1-9e86-02420a00010d','Rodrigo Lázaro Murillo','rodrigo.lazaro@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8240-1ed4-11f1-9e86-02420a00010d','Rosa Sanchez','rosa.sanchez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e824a-1ed4-11f1-9e86-02420a00010d','Sergio Arrogante Gomez','sergio.arrogante@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8268-1ed4-11f1-9e86-02420a00010d','Silvia Rodríguez González','silvia.rodriguez@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8272-1ed4-11f1-9e86-02420a00010d','Sonia Amatlle','sonia.amatlle@avvale.com','2026-03-13 12:05:10.913',0),
('e29e827c-1ed4-11f1-9e86-02420a00010d','Vanesa Domenech Alonso','vanesa.domenech@avvale.com','2026-03-13 12:05:10.913',0),
('e29e8285-1ed4-11f1-9e86-02420a00010d','Veronica Viveros Sugrañez','veronica.viveros@avvale.com','2026-03-13 12:05:10.913',0),
('e29e828f-1ed4-11f1-9e86-02420a00010d','Xavier Tor Barutel','xavier.tor@avvale.com','2026-03-13 12:05:10.913',0),
('e3688c83-7d5e-493e-9fa4-138c194b7f8d','Alfonso Garcia','alfonso.garciav@avvale.com','2026-03-24 17:32:42.412',0),
('e925cc0e-7faa-46a0-8759-6b6ca0985d48','Blas Leiva Beltran','blas.leiva@avvale.com','2026-03-24 17:32:42.936',0);
/*!40000 ALTER TABLE `cc_contacts` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `email_signature`
--

DROP TABLE IF EXISTS `email_signature`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_signature` (
  `id` varchar(191) NOT NULL,
  `content` longtext NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `user_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_signature_user_id_key` (`user_id`),
  CONSTRAINT `email_signature_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_signature`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `email_signature` WRITE;
/*!40000 ALTER TABLE `email_signature` DISABLE KEYS */;
INSERT INTO `email_signature` VALUES
('60d0a1e1-4fe2-4ae3-b498-8f1ac8243d1f','<table style=\"min-width: 50px;\"><colgroup><col style=\"min-width: 25px;\"><col style=\"min-width: 25px;\"></colgroup><tbody><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/avvale-logo.png\" alt=\"Avvale enabling what\'s next\" width=\"140\"></td><td colspan=\"1\" rowspan=\"1\"><p><strong>Alfredo Perez Lopez</strong></p><p><span style=\"color: rgb(78, 167, 46);\"><strong>Industry&nbsp;Director, CPG &amp; Retail</strong></span></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/40ff692f891444cea483289c32b609de.png\" width=\"100\"></td><td colspan=\"1\" rowspan=\"1\"><table style=\"min-width: 50px;\"><colgroup><col style=\"min-width: 25px;\"><col style=\"min-width: 25px;\"></colgroup><tbody><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/phone.png\" alt=\"Phone\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener\" href=\"tel:+34682737030\"><u>+34625237394</u></a></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/mail.png\" alt=\"Email\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener\" href=\"mailto:alfredo.perez@avvale.com\"><u>alfredo.perez@avvale.com</u></a></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/web.png\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"http://www.avvale.com\"><strong><u>www.avvale.com</u></strong></a></p></td></tr></tbody></table></td></tr></tbody></table><p></p>','2026-03-24 21:09:53.204','6804f869-1f25-4cb1-8ef8-bd8583657e5f'),
('83196043-a565-479f-b7b7-9639314ffe42','<table style=\"min-width: 50px;\"><colgroup><col style=\"min-width: 25px;\"><col style=\"min-width: 25px;\"></colgroup><tbody><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/avvale-logo.png\" alt=\"Avvale enabling what\'s next\" width=\"140\"></td><td colspan=\"1\" rowspan=\"1\"><p><strong>Alfredo Perez Lopez</strong></p><p><span style=\"color: rgb(78, 167, 46);\"><strong>Industry&nbsp;Director, CPG &amp; Retail</strong></span></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/40ff692f891444cea483289c32b609de.png\" width=\"100\"></td><td colspan=\"1\" rowspan=\"1\"><table style=\"min-width: 50px;\"><colgroup><col style=\"min-width: 25px;\"><col style=\"min-width: 25px;\"></colgroup><tbody><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/phone.png\" alt=\"Phone\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener\" href=\"tel:+34682737030\"><u>+34625237394</u></a></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/mail.png\" alt=\"Email\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener\" href=\"mailto:alfredo.perez@avvale.com\"><u>alfredo.perez@avvale.com</u></a></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/web.png\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"http://www.avvale.com\"><strong><u>www.avvale.com</u></strong></a></p></td></tr></tbody></table></td></tr></tbody></table><p></p>','2026-03-24 21:15:02.905','d565e282-a081-4baa-918e-87a1a0b01ca1'),
('8992394d-e23c-4ba0-a880-245f2f1adaab','<table style=\"min-width: 50px;\"><colgroup><col style=\"min-width: 25px;\"><col style=\"min-width: 25px;\"></colgroup><tbody><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/avvale-logo.png\" alt=\"Avvale enabling what\'s next\" width=\"140\"></td><td colspan=\"1\" rowspan=\"1\"><p><strong>Alfredo Perez Lopez</strong></p><p><span style=\"color: rgb(78, 167, 46);\"><strong>Industry&nbsp;Director, CPG &amp; Retail</strong></span></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/40ff692f891444cea483289c32b609de.png\" width=\"100\"></td><td colspan=\"1\" rowspan=\"1\"><table style=\"min-width: 50px;\"><colgroup><col style=\"min-width: 25px;\"><col style=\"min-width: 25px;\"></colgroup><tbody><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/phone.png\" alt=\"Phone\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener\" href=\"tel:+34682737030\"><u>+34625237394</u></a></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/mail.png\" alt=\"Email\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener\" href=\"mailto:alfredo.perez@avvale.com\"><u>alfredo.perez@avvale.com</u></a></p></td></tr><tr><td colspan=\"1\" rowspan=\"1\"><img src=\"https://tep-qrcode-prod.s3.eu-west-1.amazonaws.com/pictures/web.png\"></td><td colspan=\"1\" rowspan=\"1\"><p><a target=\"_blank\" rel=\"noopener noreferrer\" href=\"http://www.avvale.com\"><strong><u>www.avvale.com</u></strong></a></p></td></tr></tbody></table></td></tr></tbody></table><p></p>','2026-03-23 14:23:30.857',NULL);
/*!40000 ALTER TABLE `email_signature` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `email_templates`
--

DROP TABLE IF EXISTS `email_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_templates` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `content` longtext NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `user_id` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `email_templates_user_id_idx` (`user_id`),
  CONSTRAINT `email_templates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_templates`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `email_templates` WRITE;
/*!40000 ALTER TABLE `email_templates` DISABLE KEYS */;
INSERT INTO `email_templates` VALUES
('02d1250e-8b31-42d7-bcdb-c06cba562119','Activación Estándar - Consultoria','<p>{{Saludo}},<br><br>¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br><strong><em><br>@{{codigoOferta}}</em></strong></p><p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p><p>Marcado WON en Hubspot, link oportunidad:</p><p>{{urlHubSpot}}</p><p>&nbsp;</p><p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p><p>&nbsp;&nbsp;&nbsp;</p><p>Adjunto propuesta, PFE, aceptación del cliente y pedido</p><p>Cualquier cosa comentamos,<br></p><p>¡Saludos!</p><p></p><p></p><p></p><p></p><p></p>','2026-03-24 21:29:05.727','d565e282-a081-4baa-918e-87a1a0b01ca1'),
('6a200bf4-77e7-405e-b4e7-29ea530631cf','Activación Estándar - Software','<p>{{Saludo}},<br><br>¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br><strong><em><br>@{{codigoOferta}}</em></strong></p><p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p><p>Marcado WON en Hubspot, link oportunidad:</p><p>{{urlHubSpot}}</p><p>&nbsp;</p><p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p><p>&nbsp;&nbsp;&nbsp;</p><p>Adjunto propuesta, PFE, formulario de software y pedido</p><p>Cualquier cosa comentamos,</p><p></p><p>¡Saludos!</p><p></p><p></p><p></p><p></p>','2026-03-15 07:53:53.886',NULL),
('b192dc62-8ee8-4b09-b71c-9b345a0e0c8a','Activación Estándar - Consultoria','<p>{{Saludo}},<br><br>¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br><strong><em><br>@{{codigoOferta}}</em></strong></p><p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p><p>Marcado WON en Hubspot, link oportunidad:</p><p>{{urlHubSpot}}</p><p>&nbsp;</p><p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p><p>&nbsp;&nbsp;&nbsp;</p><p>Adjunto propuesta, PFE, aceptación del cliente y pedido</p><p>Cualquier cosa comentamos,<br></p><p>¡Saludos!</p><p></p><p></p><p></p><p></p><p></p>','2026-03-14 11:25:33.798',NULL),
('bdbb02c0-b448-480b-99e1-5b95b8e41a81','Activación Estándar - Software','<p>{{Saludo}},<br><br>¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br><strong><em><br>@{{codigoOferta}}</em></strong></p><p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p><p>Marcado WON en Hubspot, link oportunidad:</p><p>{{urlHubSpot}}</p><p>&nbsp;</p><p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p><p>&nbsp;&nbsp;&nbsp;</p><p>Adjunto propuesta, PFE, formulario de software y pedido</p><p>Cualquier cosa comentamos,</p><p></p><p>¡Saludos!</p><p></p><p></p><p></p><p></p>','2026-03-24 21:09:54.052','6804f869-1f25-4cb1-8ef8-bd8583657e5f'),
('cce3e927-f6e9-46a1-b78f-db5c5c549c24','Activación Estándar - Consultoria','<p>{{Saludo}},<br><br>¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br><strong><em><br>@{{codigoOferta}}</em></strong></p><p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p><p>Marcado WON en Hubspot, link oportunidad:</p><p>{{urlHubSpot}}</p><p>&nbsp;</p><p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p><p>&nbsp;&nbsp;&nbsp;</p><p>Adjunto propuesta, PFE, aceptación del cliente y pedido</p><p>Cualquier cosa comentamos,<br></p><p>¡Saludos!</p><p></p><p></p><p></p><p></p><p></p>','2026-03-24 21:09:53.731','6804f869-1f25-4cb1-8ef8-bd8583657e5f'),
('f746224b-43c0-482d-b2f6-9134552891ce','Activación Estándar - Software','<p>{{Saludo}},<br><br>¿Podéis activar los siguientes proyectos en&nbsp;AEP? :)<br><strong><em><br>@{{codigoOferta}}</em></strong></p><p><strong>{{tipoOportunidad}}</strong>: &nbsp;{{importeProyecto}}</p><p>Marcado WON en Hubspot, link oportunidad:</p><p>{{urlHubSpot}}</p><p>&nbsp;</p><p>Asignamos a&nbsp;{{JP de Proyecto}} como JP del proyecto.</p><p>&nbsp;&nbsp;&nbsp;</p><p>Adjunto propuesta, PFE, formulario de software y pedido</p><p>Cualquier cosa comentamos,</p><p></p><p>¡Saludos!</p><p></p><p></p><p></p><p></p>','2026-03-24 21:29:05.819','d565e282-a081-4baa-918e-87a1a0b01ca1');
/*!40000 ALTER TABLE `email_templates` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `sub_area_contacts`
--

DROP TABLE IF EXISTS `sub_area_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sub_area_contacts` (
  `id` varchar(191) NOT NULL,
  `sub_area_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `is_project_jp` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `sub_area_contacts_sub_area_id_fkey` (`sub_area_id`),
  CONSTRAINT `sub_area_contacts_sub_area_id_fkey` FOREIGN KEY (`sub_area_id`) REFERENCES `sub_areas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_area_contacts`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `sub_area_contacts` WRITE;
/*!40000 ALTER TABLE `sub_area_contacts` DISABLE KEYS */;
INSERT INTO `sub_area_contacts` VALUES
('02e8c041-ceed-4b51-b237-2db4b4e656cf','788a365c-c8cc-4896-ad67-a8345b892d0e','Antonio Sanz','antonio.sanz@avvale.com',1),
('09f676af-c131-4215-aeca-2713bc9524df','4f7dbbe0-4925-4299-9ff6-a6fcfe959ed7','Fabio Caroli','fabio.caroli@avvale.com',0),
('0eadec59-b5a9-4057-ac9e-c5bfd37ec962','6519c0af-52f2-4021-9027-4165dc707143','Juan Carlos Vidaller','juancarlos.vidaller@avvale.com',1),
('0f98458a-c83c-4961-9a96-db7721747f11','024152e4-80b1-4ce7-a434-dc2612769ecf','Manuel Ángel García','manuelangel.garcia@avvale.com',0),
('1450d81d-0926-4b54-a8d8-1e7ffb488bed','890dd9cf-f5a9-4791-a7a7-78b89029546c','Marco Martinez','marco.martinez@avvale.com',1),
('15cbb6d2-5907-4e92-a4ce-cef22c7711a7','eb264123-f6e6-4641-8c77-31e30d29c131','Ignacio Hidalgo','ignacio.hidalgo@avvale.com',1),
('16ada33a-a686-4962-9dbf-b84f124e2289','bcfe2123-d6d7-496c-a8d8-7a4ad3d4128b','Mario Morillo','mario.morillo@avvale.com',1),
('196698e0-d39a-4350-9cec-0d19be79cf30','cefe5e04-cb4c-48e0-98c2-5689af943e78','Ignacio Hidalgo','ignacio.hidalgo@avvale.com',1),
('1bc5a56b-c23d-47a9-b636-e1827a365056','69391961-80f5-4b78-99d0-2f21a147e0b0','Vanesa Domenech','vanesa.domenech@avvale.com',1),
('229f3c34-58a2-4be5-a493-02b900d89c05','eb264123-f6e6-4641-8c77-31e30d29c131','Roberto Fernandez','roberto.fernandez@avvale.com',0),
('294a0755-07d4-4296-b845-9d6e33e1ab17','69391961-80f5-4b78-99d0-2f21a147e0b0','Juan Carlos Fuentes','juancarlos.fuentes@avvale.com',0),
('294ea2c5-10d0-4587-afbc-f2175fec07e2','69391961-80f5-4b78-99d0-2f21a147e0b0','Joanandreu Blade','joanandreu.blade@avvale.com',1),
('2a38d3af-4b74-4166-b521-9e3b86300474','1a2099f0-befe-4751-8ca5-a27955bb4453','Oscar García','oscar.garcia@avvale.com',0),
('35820bd9-de86-4e87-807e-0d7a790a9774','e6a9199d-1565-4b6f-b2a6-fe5973c7971b','Ignacio Hidalgo','ignacio.hidalgo@avvale.com',1),
('3abdce76-a4c5-4088-9cc5-55d1dd4785ab','16a1e421-744d-448f-905f-04aaaf1fc566','Joanandreu Blade','joanandreu.blade@avvale.com',1),
('3ee37162-28a2-4cf1-93e9-b2e7e77921d7','374d5772-20ca-46d6-bb5c-a3be3c5b58fd','Manuel Ángel García','manuelangel.garcia@avvale.com',0),
('42003dbc-5ac4-46fa-87c2-0321164d8bf3','4f7dbbe0-4925-4299-9ff6-a6fcfe959ed7','Juan Carlos Fuentes','juancarlos.fuentes@avvale.com',0),
('44c0b2d2-06a8-4dc9-97a6-d3ea3b9b34f4','cfd26c03-10e7-449e-b14e-c136d1b00e2b','David Mestre','david.mestre@avvale.com',1),
('46573be2-17aa-4b06-8ea4-a0f7f95f0068','c9a50dc8-1c4f-494d-a115-90a27314a0d1','Pere Utreras','pere.utreras@avvale.com',0),
('467f923a-19ef-46a3-9915-2bcfb45443f6','024152e4-80b1-4ce7-a434-dc2612769ecf','Manuel Torres','manuel.torres@avvale.com',1),
('475b75e6-4193-474f-8850-03d5176682a1','fc9b4749-66a1-408a-a567-d7572cb5d2f6','Juan Carlos Vidaller','juancarlos.vidaller@avvale.com',1),
('47d57856-55fd-4bd2-8634-84652278fe48','159c63bd-1b77-4a53-bc41-87c20bdea60f','Oscar García','oscar.garcia@avvale.com',0),
('48a27d46-83be-4c59-8af4-b8d6a9050425','03a87861-a70a-4282-8c9f-00ef42047884','Alberto Hernandez','alberto.hernandez@avvale.com',1),
('5a80547b-5a30-445d-86e1-8b6be2389555','1a2099f0-befe-4751-8ca5-a27955bb4453','Enrique Torres','enrique.torres@avvale.com',1),
('5b53d880-60c1-402c-bb44-5e3399c8c319','5137b631-e4f4-41b7-a405-8f76fbd73302','Martina Zanardo','martina.zanardo@avvale.com',1),
('5dd8dc56-dec2-4612-a9ce-1f79d9262164','374d5772-20ca-46d6-bb5c-a3be3c5b58fd','Enrique Torres','enrique.torres@avvale.com',1),
('5dfbec85-3b6b-4c5e-b904-1dfaa32adb6c','cefe5e04-cb4c-48e0-98c2-5689af943e78','Roberto Fernandez','roberto.fernandez@avvale.com',0),
('606bd98a-8d82-4928-894f-2fa6ed0fcf83','1ed3d67c-4ac2-4003-b5df-59e288947a45','Mario Morillo','mario.morillo@avvale.com',1),
('6640d685-a914-4347-8923-8019b5a9f20a','b4cfbdd2-50a8-4c40-aacb-604eb3dece84','Manuel Ángel García','manuelangel.garcia@avvale.com',0),
('6ceeb85b-d089-4d5d-881c-541144cdeab0','69391961-80f5-4b78-99d0-2f21a147e0b0','Jorge Perez Climent','jorge.perez@avvale.com',1),
('6ecb1d57-5db1-4937-ac5a-d9496f69a57d','16a1e421-744d-448f-905f-04aaaf1fc566','Fabio Caroli','fabio.caroli@avvale.com',0),
('7104dd53-11b6-41ed-86d7-4b4496f38463','246fb37e-7394-420e-b5dd-c64d4ea3e5ac','Manuel Ángel García','manuelangel.garcia@avvale.com',0),
('7152a3f1-7af0-453f-b948-d3a361b2263f','b4cfbdd2-50a8-4c40-aacb-604eb3dece84','Manuel Torres','manuel.torres@avvale.com',1),
('7445a871-bd4d-4951-bb89-93f13b77a464','9ff93086-1fe4-4994-be3e-66bdad5149fa','Alberto Hernandez','alberto.hernandez@avvale.com',1),
('7753dffe-2eb2-435a-8938-f7603c8b23e9','f178c4f1-5270-4b14-b40c-1ac4d5597c3f','Marco Martinez','marco.martinez@avvale.com',1),
('79c98cb7-0268-427c-9f44-0d682fd81bea','16a1e421-744d-448f-905f-04aaaf1fc566','Vanesa Domenech','vanesa.domenech@avvale.com',1),
('7a45e4ec-d7f1-40de-869f-d4cdbaaf4acb','644743c6-ec10-41bd-aba8-073e79be7a60','Manuel Rodriguez','manuel.rodriguez@avvale.com',1),
('7f0f54bf-6e01-41d5-8dad-51240420b937','dedb6b53-ff31-4344-ac43-b50b52fe7f6a','Antonio Sanz','antonio.sanz@avvale.com',1),
('8ba71950-a372-45b7-ae3f-ad2d4030d40d','c104ffc6-131f-43cb-a86c-a72596cd0b71','Alberto Hernandez','alberto.hernandez@avvale.com',1),
('94fd4a65-92ab-4bae-aa87-31f8940d372a','4f7dbbe0-4925-4299-9ff6-a6fcfe959ed7','Vanesa Domenech','vanesa.domenech@avvale.com',1),
('a034d0d4-655b-4e72-a71a-45ad70efc2a4','c9a50dc8-1c4f-494d-a115-90a27314a0d1','Marco Martinez','marco.martinez@avvale.com',1),
('a22bd726-9f55-4ad1-b75e-09a7f6210734','374d5772-20ca-46d6-bb5c-a3be3c5b58fd','Oscar García','oscar.garcia@avvale.com',0),
('aaf867f0-498c-4dcd-a21a-f238932c65cc','16a1e421-744d-448f-905f-04aaaf1fc566','Jorge Perez Climent','jorge.perez@avvale.com',1),
('ab1a9234-3083-44dc-9b0f-48b4867af8da','b4afc1e6-9634-40f7-b198-c64a10246087','Martina Zanardo','martina.zanardo@avvale.com',1),
('ac81e2b1-0b5e-485d-ba28-9f515192dd7b','205aab6c-1e4e-49bf-9a58-021827324d89','Martina Zanardo','martina.zanardo@avvale.com',1),
('add4b7ab-fef6-4e46-a444-db80c5d414a7','16a1e421-744d-448f-905f-04aaaf1fc566','Juan Carlos Fuentes','juancarlos.fuentes@avvale.com',0),
('af2ce1a3-3d4a-4940-a8e1-9715a03a0fcb','246fb37e-7394-420e-b5dd-c64d4ea3e5ac','Manuel Torres','manuel.torres@avvale.com',1),
('b3130ee0-27fd-45c2-8984-febce3d2ada9','890dd9cf-f5a9-4791-a7a7-78b89029546c','Pere Utreras','pere.utreras@avvale.com',0),
('b527e686-a159-4b23-ad00-9676803ba997','159c63bd-1b77-4a53-bc41-87c20bdea60f','Enrique Torres','enrique.torres@avvale.com',1),
('b592f7e5-ab29-417f-a728-cd65e834dc1a','4f7dbbe0-4925-4299-9ff6-a6fcfe959ed7','Jorge Perez Climent','jorge.perez@avvale.com',1),
('b937b92e-701a-4540-a909-100570637cb6','f178c4f1-5270-4b14-b40c-1ac4d5597c3f','Pere Utreras','pere.utreras@avvale.com',0),
('be1f21ca-f4aa-4b8f-8e02-8a4b0abb9c39','f06dca9a-3ab8-4723-a33b-ca2a6e14bb7e','David Mestre','david.mestre@avvale.com',1),
('c1cea73a-beb5-4de5-9e2e-5c5159539e6c','7e2c3e4e-65b2-4c6a-a381-ce23527432b4','Manuel Rodriguez','manuel.rodriguez@avvale.com',1),
('c5f90659-dbac-419f-9939-4107032125b6','159c63bd-1b77-4a53-bc41-87c20bdea60f','Manuel Ángel García','manuelangel.garcia@avvale.com',0),
('cf0da809-569c-46c0-a85c-585fc996b5cc','890dd9cf-f5a9-4791-a7a7-78b89029546c','Daniel Marchante','daniel.marchante@avvale.com',0),
('d9935d3d-53f2-4964-989f-d9f54af4f377','69391961-80f5-4b78-99d0-2f21a147e0b0','Fabio Caroli','fabio.caroli@avvale.com',0),
('de0509ce-b7d6-4662-b7b8-36ecb7a9d6d1','4f7dbbe0-4925-4299-9ff6-a6fcfe959ed7','Joanandreu Blade','joanandreu.blade@avvale.com',1),
('e5a74f78-e6fb-408f-8269-8e51a4d7caa5','c9a50dc8-1c4f-494d-a115-90a27314a0d1','Daniel Marchante','daniel.marchante@avvale.com',0),
('ea35757b-68bb-4d36-a66e-7fe2b67dfaf9','1a2099f0-befe-4751-8ca5-a27955bb4453','Manuel Ángel García','manuelangel.garcia@avvale.com',0),
('ec5ccd6d-c534-4993-90cb-c75699e69c37','d61cec0d-5072-4f15-abf3-bc01d9eb930b','Mario Morillo','mario.morillo@avvale.com',1),
('f23f970a-0e12-4408-a755-f50f394b7300','f178c4f1-5270-4b14-b40c-1ac4d5597c3f','Daniel Marchante','daniel.marchante@avvale.com',0),
('f52aeb47-6e93-42ef-93b0-8b0b47425b33','0620f60c-99f1-4649-ab44-0525ebe3c8c4','David Mestre','david.mestre@avvale.com',1),
('f75d07d8-670e-4256-951a-1c38e77ab5e9','e6a9199d-1565-4b6f-b2a6-fe5973c7971b','Roberto Fernandez','roberto.fernandez@avvale.com',0),
('f818096e-c886-47e5-8453-c10ca0cf4aa0','a97ba52d-10b1-4506-bb77-00f117e32a29','Antonio Sanz','antonio.sanz@avvale.com',1),
('f847fdb4-5400-4e60-a4e3-4953c2d5f40b','fe059a39-b81e-4af5-9801-7c23c31a0838','Manuel Rodriguez','manuel.rodriguez@avvale.com',1),
('faa98479-f1ce-40c1-a046-c34cf3bb1cf7','5c95a061-2df3-4e85-8259-c980ef762258','Juan Carlos Vidaller','juancarlos.vidaller@avvale.com',1);
/*!40000 ALTER TABLE `sub_area_contacts` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `sub_areas`
--

DROP TABLE IF EXISTS `sub_areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sub_areas` (
  `id` varchar(191) NOT NULL,
  `area_id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `sub_areas_area_id_fkey` (`area_id`),
  CONSTRAINT `sub_areas_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_areas`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `sub_areas` WRITE;
/*!40000 ALTER TABLE `sub_areas` DISABLE KEYS */;
INSERT INTO `sub_areas` VALUES
('024152e4-80b1-4ce7-a434-dc2612769ecf','0105febf-8cd5-4bdb-a649-7ee2329c162a','IA','2026-03-24 21:09:57.301'),
('03a87861-a70a-4282-8c9f-00ef42047884','07bb8453-1227-43ab-80f5-ace448056bc1','CMS','2026-03-24 21:09:58.165'),
('0620f60c-99f1-4649-ab44-0525ebe3c8c4','bf9f4c3a-5319-46f6-8059-13ab43e11242','CX','2026-03-24 21:10:02.219'),
('159c63bd-1b77-4a53-bc41-87c20bdea60f','9cd8636a-2030-4a33-a25b-88d8c8ec5f77','Data','2026-03-24 21:15:06.567'),
('16a1e421-744d-448f-905f-04aaaf1fc566','d844940e-8fba-41f8-bb62-7d69a55a8e49','O&L','2026-03-24 21:15:13.350'),
('179071b3-abdf-4b2d-8700-aa7c7d12bc9c','9fc5b003-2fc3-4601-835e-e65eb8396721','ESG','2026-03-24 08:40:08.437'),
('1a2099f0-befe-4751-8ca5-a27955bb4453','86bb15fb-1b16-4c59-acf9-0f72f45ba3df','Data','2026-03-22 12:29:22.352'),
('1ed3d67c-4ac2-4003-b5df-59e288947a45','9cd8636a-2030-4a33-a25b-88d8c8ec5f77','CloudDev','2026-03-24 21:15:04.888'),
('205aab6c-1e4e-49bf-9a58-021827324d89','c47de9c2-148e-40a1-80ea-7143e9d0b82a','Producto','2026-03-24 09:44:42.049'),
('2386fe25-e144-4e3f-b9fc-e1c3d2417b69','d704fd01-b977-4106-bf9c-c6c9b86f0ba5','ESG','2026-03-24 21:15:11.714'),
('246fb37e-7394-420e-b5dd-c64d4ea3e5ac','86bb15fb-1b16-4c59-acf9-0f72f45ba3df','IA','2026-03-22 12:31:19.486'),
('374d5772-20ca-46d6-bb5c-a3be3c5b58fd','0105febf-8cd5-4bdb-a649-7ee2329c162a','Data','2026-03-24 21:09:56.491'),
('4aa61232-48a6-4f74-a3cf-0a0c716bf26d','9fc5b003-2fc3-4601-835e-e65eb8396721','EPM','2026-03-24 08:40:02.796'),
('4f7dbbe0-4925-4299-9ff6-a6fcfe959ed7','bf9f4c3a-5319-46f6-8059-13ab43e11242','O&L','2026-03-24 21:10:02.683'),
('5137b631-e4f4-41b7-a405-8f76fbd73302','32caa81b-1cdc-470a-8bfb-a0a883887e2f','Producto','2026-03-24 21:10:00.265'),
('5c95a061-2df3-4e85-8259-c980ef762258','86bb15fb-1b16-4c59-acf9-0f72f45ba3df','Fiori','2026-03-13 10:07:31.092'),
('644743c6-ec10-41bd-aba8-073e79be7a60','c7a4028e-5ff5-4713-9306-4f1f4265c608','AMS','2026-03-24 21:15:09.144'),
('6519c0af-52f2-4021-9027-4165dc707143','9cd8636a-2030-4a33-a25b-88d8c8ec5f77','Fiori','2026-03-24 21:15:05.519'),
('69391961-80f5-4b78-99d0-2f21a147e0b0','81eef10a-5bd5-46c5-9dce-d1fc13fe86c5','O&L','2026-03-24 08:41:24.744'),
('788a365c-c8cc-4896-ad67-a8345b892d0e','86bb15fb-1b16-4c59-acf9-0f72f45ba3df','Integración','2026-03-13 10:29:29.974'),
('7aea77a5-e988-4209-b965-8b0a9a146017','d704fd01-b977-4106-bf9c-c6c9b86f0ba5','EPM','2026-03-24 21:15:11.515'),
('7e2c3e4e-65b2-4c6a-a381-ce23527432b4','07bb8453-1227-43ab-80f5-ace448056bc1','AMS','2026-03-24 21:09:58.656'),
('890dd9cf-f5a9-4791-a7a7-78b89029546c','c7a4028e-5ff5-4713-9306-4f1f4265c608','BASIS','2026-03-24 21:15:09.631'),
('8a092773-62a8-45e6-a6ec-c5b1f1c7cf7b','f3894bdc-f239-4710-a389-18f5a21525a9','ESG','2026-03-24 21:10:01.165'),
('9ff93086-1fe4-4994-be3e-66bdad5149fa','0897e0d6-6409-4cad-aede-ba371e71d44b','CMS','2026-03-13 10:31:10.059'),
('a17d0733-3440-4e32-a992-90eaaddd5f0e','f3894bdc-f239-4710-a389-18f5a21525a9','EPM','2026-03-24 21:10:00.925'),
('a97ba52d-10b1-4506-bb77-00f117e32a29','0105febf-8cd5-4bdb-a649-7ee2329c162a','Integración','2026-03-24 21:09:56.057'),
('b4afc1e6-9634-40f7-b198-c64a10246087','4505be87-60fc-4d98-b907-b6ebef6449a2','Producto','2026-03-24 21:15:10.759'),
('b4cfbdd2-50a8-4c40-aacb-604eb3dece84','9cd8636a-2030-4a33-a25b-88d8c8ec5f77','IA','2026-03-24 21:15:07.624'),
('bcfe2123-d6d7-496c-a8d8-7a4ad3d4128b','0105febf-8cd5-4bdb-a649-7ee2329c162a','CloudDev','2026-03-24 21:09:55.011'),
('c104ffc6-131f-43cb-a86c-a72596cd0b71','c7a4028e-5ff5-4713-9306-4f1f4265c608','CMS','2026-03-24 21:15:08.674'),
('c9a50dc8-1c4f-494d-a115-90a27314a0d1','07bb8453-1227-43ab-80f5-ace448056bc1','BASIS','2026-03-24 21:09:59.119'),
('cefe5e04-cb4c-48e0-98c2-5689af943e78','d844940e-8fba-41f8-bb62-7d69a55a8e49','ABAP DEV','2026-03-24 21:15:12.193'),
('cfd26c03-10e7-449e-b14e-c136d1b00e2b','d844940e-8fba-41f8-bb62-7d69a55a8e49','CX','2026-03-24 21:15:12.865'),
('d61cec0d-5072-4f15-abf3-bc01d9eb930b','86bb15fb-1b16-4c59-acf9-0f72f45ba3df','CloudDev','2026-03-13 10:06:47.142'),
('dedb6b53-ff31-4344-ac43-b50b52fe7f6a','9cd8636a-2030-4a33-a25b-88d8c8ec5f77','Integración','2026-03-24 21:15:06.008'),
('e6a9199d-1565-4b6f-b2a6-fe5973c7971b','bf9f4c3a-5319-46f6-8059-13ab43e11242','ABAP DEV','2026-03-24 21:10:01.595'),
('eb264123-f6e6-4641-8c77-31e30d29c131','81eef10a-5bd5-46c5-9dce-d1fc13fe86c5','ABAP DEV','2026-03-24 08:41:09.473'),
('f06dca9a-3ab8-4723-a33b-ca2a6e14bb7e','81eef10a-5bd5-46c5-9dce-d1fc13fe86c5','CX','2026-03-24 08:41:15.104'),
('f178c4f1-5270-4b14-b40c-1ac4d5597c3f','0897e0d6-6409-4cad-aede-ba371e71d44b','BASIS','2026-03-13 11:24:34.442'),
('fc9b4749-66a1-408a-a567-d7572cb5d2f6','0105febf-8cd5-4bdb-a649-7ee2329c162a','Fiori','2026-03-24 21:09:55.633'),
('fe059a39-b81e-4af5-9801-7c23c31a0838','0897e0d6-6409-4cad-aede-ba371e71d44b','AMS','2026-03-13 10:31:58.330');
/*!40000 ALTER TABLE `sub_areas` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `name` varchar(191) DEFAULT NULL,
  `password_hash` varchar(191) NOT NULL,
  `role` enum('USER','ADMIN') NOT NULL DEFAULT 'USER',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `last_name` varchar(191) DEFAULT NULL,
  `position` varchar(191) DEFAULT NULL,
  `appearance` varchar(191) DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `avatar_path` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
('6804f869-1f25-4cb1-8ef8-bd8583657e5f','alfredo.perez@avvale.com','Alfredo','$2b$10$nh/T9RupAyBxEilAgXS0f.QsQPOIkdfvfrTYrDf4NDLq9GR5xZ0a6','ADMIN','2026-03-12 12:35:01.052','Pérez','Industry Director - Consumer','fiori',1,NULL),
('95888ef5-db11-424b-beed-f5fc5c681209','guillermo.truan@avvale.com','Guillermo Truan','$2b$10$gvgdQtOW/9HHLORNv.30Su0DyBSh.e5m5g7XvBWAFsZW0fGegYqFa','ADMIN','2026-03-16 20:38:49.671',NULL,'Growth Managing Director',NULL,0,NULL),
('d565e282-a081-4baa-918e-87a1a0b01ca1','david.rodriguezb@avvale.com','David Rodriguez','$2b$10$ZFDOz2fRntLfGQEjoOXoCu41c4EcLlf2OxUEE1391Sh0Huwakg2Dq','USER','2026-03-24 12:48:25.321',NULL,'Account Manager - Consumer','fiori',1,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Dumping routines for database 'default'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-03-24 23:02:02
