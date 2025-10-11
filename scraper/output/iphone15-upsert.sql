-- Upsert script for Apple iPhone 15 merged payload
-- Run this in Supabase SQL editor (requires authenticated session)

DO $$
DECLARE
  v_exists RECORD;
  v_payload jsonb := (
    {
      "nama_brand": "Apple",
      "nama_model": "Apple iPhone 15",
      "variant": null,
      "kode_model": null,
      "official_specs": [],
      "unofficial_specs": {
        "name": "Apple Apple iPhone 15",
        "img": "https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-15.jpg",
        "detailSpec": [],
        "quickSpec": []
      },
      "status": "aktif",
      "updated_at": now()::text
    }::jsonb
  );
BEGIN
  SELECT * INTO v_exists FROM master_unit WHERE nama_brand = (v_payload->>'nama_brand') AND nama_model = (v_payload->>'nama_model') LIMIT 1;
  IF FOUND THEN
    UPDATE master_unit SET
      official_specs = COALESCE((v_payload->'official_specs')::jsonb, official_specs),
      unofficial_specs = COALESCE((v_payload->'unofficial_specs')::jsonb, unofficial_specs),
      status = v_payload->>'status',
      updated_at = now()
    WHERE id_master = v_exists.id_master;
    RAISE NOTICE 'Updated master_unit id %', v_exists.id_master;
  ELSE
  INSERT INTO master_unit (nama_brand, nama_model, variant, kode_model, official_specs, unofficial_specs, status, updated_at)
    VALUES (
      v_payload->>'nama_brand',
      v_payload->>'nama_model',
      NULL, NULL,
      (v_payload->'official_specs')::jsonb,
      (v_payload->'unofficial_specs')::jsonb,
      v_payload->>'status',
      now()
    );
    RAISE NOTICE 'Inserted new master_unit';
  END IF;
END$$;
