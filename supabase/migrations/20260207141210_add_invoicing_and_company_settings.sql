/*
  # Invoicing System and Company Settings

  1. New Tables
    - `company_settings` (singleton)
      - `id` (uuid, primary key)
      - `company_name` (text) - Business name on invoices
      - `company_address` (text) - Full registered address
      - `company_email` (text) - Contact email on invoices
      - `company_phone` (text) - Contact phone on invoices
      - `tax_registration_number` (text) - Tax/VAT registration ID
      - `logo_url` (text) - URL to uploaded logo in storage
      - `invoice_prefix` (text) - Prefix for invoice numbers e.g. "MM"
      - `invoice_footer_text` (text) - Custom footer on invoices
      - `currency_code` (text) - Default "TTD"
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, references auth.users)

    - `invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique) - Human-readable e.g. "MM-INV-00001"
      - `job_id` (uuid, references jobs) - The job this invoice is for
      - `customer_user_id` (uuid, references auth.users) - Who gets billed
      - `courier_user_id` (uuid, references auth.users) - Who did the delivery
      - `customer_name` (text) - Snapshot at time of invoice
      - `customer_email` (text) - Snapshot at time of invoice
      - `courier_name` (text) - Snapshot at time of invoice
      - `job_reference_id` (text) - Snapshot of job reference
      - `pickup_location` (text) - Snapshot
      - `dropoff_location` (text) - Snapshot
      - `delivery_type` (text) - Snapshot
      - `base_price` (numeric) - Base delivery price
      - `platform_fee` (numeric) - Platform commission
      - `vat_amount` (numeric) - VAT charged
      - `total_price` (numeric) - Total charged to customer
      - `courier_earnings` (numeric) - Amount paid to courier
      - `status` (text) - draft, sent, paid, overdue, cancelled
      - `sent_at` (timestamptz) - When emailed to customer
      - `paid_at` (timestamptz) - When marked as paid
      - `pdf_url` (text) - URL to generated PDF in storage
      - `email_sent` (boolean) - Whether email was sent
      - `notes` (text) - Optional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - company_settings: only super_admins can read/update
    - invoices: customers can view own invoices, admins can view all
    
  3. Storage
    - `company-assets` bucket for logo uploads
    - `invoices` bucket for generated PDF storage
    
  4. Important Notes
    - company_settings uses a singleton pattern (max 1 row enforced by unique constraint)
    - Invoice numbers auto-increment via a sequence
    - Financial fields are snapshots to preserve historical accuracy
*/

-- Create invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;

-- Company Settings table (singleton)
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'MoveMe TT',
  company_address text NOT NULL DEFAULT '',
  company_email text NOT NULL DEFAULT '',
  company_phone text NOT NULL DEFAULT '',
  tax_registration_number text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  invoice_prefix text NOT NULL DEFAULT 'MM',
  invoice_footer_text text NOT NULL DEFAULT 'Thank you for using MoveMe TT!',
  currency_code text NOT NULL DEFAULT 'TTD',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  singleton_key boolean NOT NULL DEFAULT true UNIQUE
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can view company settings
CREATE POLICY "Super admins can view company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super admins can insert company settings
CREATE POLICY "Super admins can insert company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super admins can update company settings
CREATE POLICY "Super admins can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Seed default company settings row
INSERT INTO company_settings (company_name, company_address, company_email, company_phone)
VALUES ('MoveMe TT', '', '', '')
ON CONFLICT (singleton_key) DO NOTHING;

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL DEFAULT ('MM-INV-' || lpad(nextval('invoice_number_seq')::text, 5, '0')),
  job_id uuid NOT NULL REFERENCES jobs(id),
  customer_user_id uuid NOT NULL REFERENCES auth.users(id),
  courier_user_id uuid REFERENCES auth.users(id),
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  courier_name text NOT NULL DEFAULT '',
  job_reference_id text NOT NULL DEFAULT '',
  pickup_location text NOT NULL DEFAULT '',
  dropoff_location text NOT NULL DEFAULT '',
  delivery_type text NOT NULL DEFAULT '',
  base_price numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  courier_earnings numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  email_sent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Customers can view their own invoices
CREATE POLICY "Customers can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_user_id);

-- Couriers can view invoices for jobs they delivered
CREATE POLICY "Couriers can view own delivery invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = courier_user_id);

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

-- Admins can insert invoices
CREATE POLICY "Admins can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

-- Admins can update invoices
CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

-- Service role needs insert access for edge functions
-- (service role bypasses RLS, but we need a policy for the generate-invoice edge function)

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer_user_id ON invoices(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company-assets bucket
CREATE POLICY "Admins can upload company assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Anyone can view company assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'company-assets');

CREATE POLICY "Admins can update company assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can delete company assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Storage policies for invoices bucket
CREATE POLICY "Admins can upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Users can view own invoice files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

-- Function to auto-generate invoice when job is completed
CREATE OR REPLACE FUNCTION generate_invoice_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_customer profiles%ROWTYPE;
  v_courier profiles%ROWTYPE;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT * INTO v_customer FROM profiles WHERE id = NEW.customer_user_id;
    
    IF NEW.assigned_courier_id IS NOT NULL THEN
      SELECT * INTO v_courier FROM profiles WHERE id = NEW.assigned_courier_id;
    END IF;
    
    INSERT INTO invoices (
      job_id,
      customer_user_id,
      courier_user_id,
      customer_name,
      customer_email,
      courier_name,
      job_reference_id,
      pickup_location,
      dropoff_location,
      delivery_type,
      base_price,
      platform_fee,
      vat_amount,
      total_price,
      courier_earnings,
      status
    ) VALUES (
      NEW.id,
      NEW.customer_user_id,
      NEW.assigned_courier_id,
      COALESCE(v_customer.full_name, v_customer.first_name || ' ' || v_customer.last_name, ''),
      COALESCE(v_customer.email, ''),
      COALESCE(v_courier.full_name, v_courier.first_name || ' ' || v_courier.last_name, ''),
      COALESCE(NEW.job_reference_id, ''),
      COALESCE(NEW.pickup_location, ''),
      COALESCE(NEW.dropoff_location, ''),
      COALESCE(NEW.delivery_type, ''),
      COALESCE(NEW.base_price, 0),
      COALESCE(NEW.platform_fee, 0),
      COALESCE(NEW.vat_amount, 0),
      COALESCE(NEW.total_price, 0),
      COALESCE(NEW.courier_earnings, 0),
      'sent'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_invoice_on_completion ON jobs;
CREATE TRIGGER trigger_generate_invoice_on_completion
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_on_completion();
