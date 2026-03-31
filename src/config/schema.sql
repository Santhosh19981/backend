-- ============================================================
-- CarMate Database Schema
-- Australia Car Rental Platform
-- ============================================================

CREATE DATABASE IF NOT EXISTS carmate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE carmate_db;

-- USERS
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(180) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin','owner','customer') NOT NULL DEFAULT 'customer',
  phone       VARCHAR(20),
  avatar_url  VARCHAR(500),
  is_verified TINYINT(1) DEFAULT 0,
  otp         VARCHAR(10),
  otp_expires DATETIME,
  fcm_token   VARCHAR(500),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- OWNER PROFILES
CREATE TABLE owner_profiles (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT UNIQUE NOT NULL,
  license_no          VARCHAR(50),
  id_proof_url        VARCHAR(500),
  id_proof_type       ENUM('drivers_license','passport','national_id'),
  verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
  rejection_reason    TEXT,
  bsb_number          VARCHAR(20),
  account_number      VARCHAR(30),
  account_name        VARCHAR(120),
  total_earnings      DECIMAL(10,2) DEFAULT 0.00,
  verified_at         DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CARS
CREATE TABLE cars (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  owner_id         INT NOT NULL,
  brand            VARCHAR(80) NOT NULL,
  model            VARCHAR(80) NOT NULL,
  year             YEAR NOT NULL,
  fuel_type        ENUM('petrol','diesel','hybrid','electric') DEFAULT 'petrol',
  transmission     ENUM('automatic','manual') DEFAULT 'automatic',
  seats            TINYINT DEFAULT 5,
  color            VARCHAR(40),
  registration_no  VARCHAR(20),
  description      TEXT,
  features         JSON,
  location_suburb  VARCHAR(100),
  location_city    VARCHAR(80) DEFAULT 'Sydney',
  location_state   VARCHAR(60) DEFAULT 'NSW',
  location_lat     DECIMAL(10,8),
  location_lng     DECIMAL(11,8),
  weekly_price     DECIMAL(10,2) NOT NULL,
  status           ENUM('pending','approved','rejected','unavailable') DEFAULT 'pending',
  rejection_reason TEXT,
  rating_avg       DECIMAL(3,2) DEFAULT 0.00,
  rating_count     INT DEFAULT 0,
  approved_by      INT,
  approved_at      DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CAR IMAGES
CREATE TABLE car_images (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  car_id     INT NOT NULL,
  image_url  VARCHAR(500) NOT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- CAR DOCUMENTS
CREATE TABLE car_documents (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  car_id   INT NOT NULL,
  doc_type ENUM('registration','insurance','roadworthy') NOT NULL,
  doc_url  VARCHAR(500) NOT NULL,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- BOOKINGS
CREATE TABLE bookings (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  car_id                 INT NOT NULL,
  customer_id            INT NOT NULL,
  start_date             DATE NOT NULL,
  end_date               DATE NOT NULL,
  weeks_count            INT NOT NULL DEFAULT 1,
  total_amount           DECIMAL(10,2) NOT NULL,
  platform_fee           DECIMAL(10,2) NOT NULL,
  owner_amount           DECIMAL(10,2) NOT NULL,
  status                 ENUM('pending','confirmed','active','completed','cancelled') DEFAULT 'pending',
  payment_status         ENUM('unpaid','partial','paid','refunded') DEFAULT 'unpaid',
  stripe_payment_intent  VARCHAR(120),
  coupon_id              INT,
  discount_amount        DECIMAL(10,2) DEFAULT 0,
  cancellation_reason    TEXT,
  cancelled_at           DATETIME,
  created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (car_id) REFERENCES cars(id),
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

-- BOOKING WEEKS (for weekly settlement)
CREATE TABLE booking_weeks (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  booking_id     INT NOT NULL,
  week_number    INT NOT NULL,
  week_start     DATE NOT NULL,
  week_end       DATE NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  platform_fee   DECIMAL(10,2) NOT NULL,
  owner_amount   DECIMAL(10,2) NOT NULL,
  payment_status ENUM('pending','paid','settled') DEFAULT 'pending',
  stripe_charge  VARCHAR(120),
  paid_at        DATETIME,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- PAYMENTS
CREATE TABLE payments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT NOT NULL,
  booking_week_id  INT,
  amount           DECIMAL(10,2) NOT NULL,
  platform_fee     DECIMAL(10,2) NOT NULL,
  owner_earnings   DECIMAL(10,2) NOT NULL,
  stripe_charge_id VARCHAR(120),
  stripe_pi_id     VARCHAR(120),
  status           ENUM('pending','succeeded','failed','refunded') DEFAULT 'pending',
  refund_amount    DECIMAL(10,2) DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (booking_week_id) REFERENCES booking_weeks(id)
);

-- AVAILABILITY BLOCKS
CREATE TABLE availability_blocks (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  car_id      INT NOT NULL,
  booking_id  INT,
  block_start DATE NOT NULL,
  block_end   DATE NOT NULL,
  block_type  ENUM('booking','manual') DEFAULT 'booking',
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

-- REVIEWS
CREATE TABLE reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  car_id      INT NOT NULL,
  customer_id INT NOT NULL,
  booking_id  INT UNIQUE NOT NULL,
  rating      TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  reply       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (car_id) REFERENCES cars(id),
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  type       ENUM('booking','car_status','payment','review','system') DEFAULT 'system',
  is_read    TINYINT(1) DEFAULT 0,
  data_json  JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- COMMISSIONS
CREATE TABLE commissions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  percentage       DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  effective_from   DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by       INT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- COUPONS
CREATE TABLE coupons (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30) UNIQUE NOT NULL,
  description   VARCHAR(200),
  discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
  value         DECIMAL(10,2) NOT NULL,
  min_amount    DECIMAL(10,2) DEFAULT 0,
  max_discount  DECIMAL(10,2),
  uses_limit    INT,
  uses_count    INT DEFAULT 0,
  expires_at    DATETIME,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- COUPON USES
CREATE TABLE coupon_uses (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id  INT NOT NULL,
  user_id    INT NOT NULL,
  booking_id INT NOT NULL,
  used_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- REFERRALS
CREATE TABLE referrals (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id   INT NOT NULL,
  referred_id   INT NOT NULL,
  referral_code VARCHAR(20) NOT NULL,
  bonus_amount  DECIMAL(10,2) DEFAULT 20.00,
  status        ENUM('pending','credited') DEFAULT 'pending',
  credited_at   DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
);

-- Default admin + commission
INSERT INTO users (name, email, password, role, is_verified) VALUES
('CarMate Admin', 'admin@carmate.com.au', '$2a$10$placeholder_hash_change_me', 'admin', 1);

INSERT INTO commissions (percentage, effective_from) VALUES (15.00, NOW());
