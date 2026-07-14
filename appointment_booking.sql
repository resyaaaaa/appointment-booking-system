-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 14, 2026 at 05:50 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `appointment_booking`
--

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` varchar(100) NOT NULL,
  `customerName` varchar(255) DEFAULT NULL,
  `customerEmail` varchar(255) DEFAULT NULL,
  `customerPhone` varchar(100) DEFAULT NULL,
  `date` varchar(100) DEFAULT NULL,
  `timeSlot` varchar(100) DEFAULT NULL,
  `serviceId` varchar(100) DEFAULT NULL,
  `staffId` varchar(100) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdAt` varchar(100) DEFAULT NULL,
  `reminderSent` tinyint(4) DEFAULT NULL,
  `reminderTemplateId` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `appointments`
--

INSERT INTO `appointments` (`id`, `customerName`, `customerEmail`, `customerPhone`, `date`, `timeSlot`, `serviceId`, `staffId`, `status`, `notes`, `createdAt`, `reminderSent`, `reminderTemplateId`) VALUES
('apt-a7lun9yqb1', 'Resyalizatul', 'idontknow10152@gmail.com', '123456789', '2026-07-11', '09:00 AM', 's1', 'st-3', 'confirmed', 'No bleach', '2026-07-08T06:03:19.630Z', 0, NULL),
('apt-lad2sn8zp4', 'dsd', 'name@example.com', NULL, '2026-07-10', '02:30 PM', 's4', 'st-1', 'confirmed', '', '2026-07-03T07:37:02.745Z', 0, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `availability`
--

CREATE TABLE `availability` (
  `dayOfWeek` int(11) NOT NULL,
  `isWorkingDay` tinyint(4) DEFAULT NULL,
  `startTime` varchar(50) DEFAULT NULL,
  `endTime` varchar(50) DEFAULT NULL,
  `breakTimeStart` varchar(50) DEFAULT NULL,
  `breakTimeEnd` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `availability`
--

INSERT INTO `availability` (`dayOfWeek`, `isWorkingDay`, `startTime`, `endTime`, `breakTimeStart`, `breakTimeEnd`) VALUES
(0, 0, '09:00', '17:00', NULL, NULL),
(1, 1, '09:00', '18:00', '12:00', '13:00'),
(2, 1, '09:00', '18:00', '12:00', '13:00'),
(3, 1, '09:00', '18:00', '12:00', '13:00'),
(4, 1, '09:00', '18:00', '12:00', '13:00'),
(5, 1, '09:00', '18:00', '12:00', '13:00'),
(6, 1, '09:00', '16:00', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `custom_blocks`
--

CREATE TABLE `custom_blocks` (
  `id` varchar(100) NOT NULL,
  `date` varchar(100) DEFAULT NULL,
  `startTime` varchar(50) DEFAULT NULL,
  `endTime` varchar(50) DEFAULT NULL,
  `reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `custom_blocks`
--

INSERT INTO `custom_blocks` (`id`, `date`, `startTime`, `endTime`, `reason`) VALUES
('block-1', '2026-07-13', '09:00', '12:00', 'Staff training session');

-- --------------------------------------------------------

--
-- Table structure for table `email_templates`
--

CREATE TABLE `email_templates` (
  `id` varchar(100) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `body` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `email_templates`
--

INSERT INTO `email_templates` (`id`, `name`, `type`, `subject`, `body`) VALUES
('tpl-can', 'Appointment Cancellation Alert', 'cancellation', 'Cancellation Notice: {service_name} reschedule options', 'Hello {customer_name},\n\nYour scheduled appointment on {appointment_date} at {appointment_time} for \"{service_name}\" has been successfully cancelled.\n\nIf this was done in error or you would like to book a different slot, please reply to this alert or schedule on our web portal.\n\nSincerely,\n{business_name}'),
('tpl-conf', 'Standard Booking Confirmation', 'confirmation', 'Reservation Confirmed: {service_name} with {business_name}', 'Hello {customer_name},\n\nYour appointment is confirmed!\n\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\n\nStaff Notes: {notes}\n\nWe look forward to giving you an exceptional experience. If you need to make corrections, reply to this email or call us directly!\n\nBest regards,\nThe Team at {business_name}'),
('tpl-rem', 'Day-Before Appointment Reminder', 'reminder', 'Reminder: Your upcoming reservation at {business_name} tomorrow', 'Hi {customer_name},\n\nWe are looking forward to seeing you tomorrow for your appointment!\n\nBusiness: {business_name}\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\n\nLocation: 404 Design District, Suite 300\n\nIf you must reschedule, please give us a courtesy heads-up.\n\nWarmly,\n{business_name}');

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` varchar(100) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `durationMinutes` int(11) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `isActive` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `name`, `durationMinutes`, `price`, `description`, `isActive`) VALUES
('s1', 'Deluxe Haircut & Styling', 45, 45.00, 'Signature haircut, shampoo wash, scalp massage, and custom blow-dry blow styling.', 1),
('s2', 'Premium Beard Grooming', 30, 30.00, 'Hot towel prep, detailed straight-razor lineup, trimming, and organic beard oil treatment.', 1),
('s3', 'The Royal Service (Combo)', 75, 70.00, 'Deluxe haircut combined with Premium Beard Grooming and a refreshing charcoal peeling mask.', 1),
('s4', 'Classic Face Massage & Facial', 45, 50.00, 'Rejuvenating mud mask, steaming hot towels, facial massage, and hydrating sunscreen application.', 1);

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` varchar(100) NOT NULL,
  `businessName` varchar(255) DEFAULT NULL,
  `currency` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `contactEmail` varchar(255) DEFAULT NULL,
  `contactPhone` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `businessName`, `currency`, `address`, `contactEmail`, `contactPhone`) VALUES
('1', 'Resya co', 'RM', 'Imago Loft Entrance', 'name@example.com', '222777');

-- --------------------------------------------------------

--
-- Table structure for table `staff`
--

CREATE TABLE `staff` (
  `id` varchar(100) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `role` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `active` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `staff`
--

INSERT INTO `staff` (`id`, `name`, `role`, `email`, `active`) VALUES
('st-1', 'Alex Rivera', 'Master Barber', 'alex@example.com', 1),
('st-2', 'Maria Santos', 'Color Specialist', 'maria@example.com', 1),
('st-3', 'Jordan Lee', 'Stylist Professional', 'jordan@example.com', 1),
('st-vpnxwumfu', 'Resya', 'Stylist', 'resya@example.com', 1),
('stu1', 'Admin Owner', 'Business Owner', 'name@example.com', 1),
('stu1782891341035', 'resya', 'Staff', 'res@a.com', 1),
('stu1783490641388', 'fay', 'Staff', 'fay@example.com', 1);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(100) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `passwordHash` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `role` varchar(100) DEFAULT NULL,
  `phone` varchar(100) DEFAULT NULL,
  `createdAt` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `passwordHash`, `name`, `role`, `phone`, `createdAt`) VALUES
('u-1', 'name@example.com', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'Admin Owner', 'owner', '555-0100', '2026-06-15T00:00:00.000Z'),
('u1783490641388', 'fay@example.com', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'fay', 'staff', '123456789', '2026-07-08T06:04:01.388Z');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `availability`
--
ALTER TABLE `availability`
  ADD PRIMARY KEY (`dayOfWeek`);

--
-- Indexes for table `custom_blocks`
--
ALTER TABLE `custom_blocks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `email_templates`
--
ALTER TABLE `email_templates`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `staff`
--
ALTER TABLE `staff`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
