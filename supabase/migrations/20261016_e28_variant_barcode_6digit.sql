-- E28 (2026-10-16): barcode label seragam 6 digit (Code128 subset C, 68 modul x 3 dot = 25,5 mm).
-- Keputusan user: semua varian dapat kode angka 6 digit di kolom `barcode`; SKU lama TIDAK diubah
-- (label lama ber-SKU teks tetap ter-scan karena POS mencocokkan sku maupun barcode).
-- Varian salinan antar toko (SKU sama, hasil transfer) berbagi barcode yang sama.
-- SUDAH DITERAPKAN ke produksi 2026-10-16 lewat REST (sesi manager); file ini catatan + idempoten
-- (hanya mengisi baris yang barcode-nya masih kosong).
-- Rollback: UPDATE public.variants SET barcode = NULL WHERE id IN (<id di bawah>);
--   (sebelum backfill semua barcode NULL, kecuali 3 baris berisi '' : 092a1fd5…, 190dec38…, a7c78578…)
begin;
update public.variants set barcode = '983749' where id = '003d43e5-d215-45da-a76e-58fab73d854c' and coalesce(barcode, '') = '';  -- Rok / rok 100 / sku 90812354
update public.variants set barcode = '711373' where id = '0377c6e8-ed5a-4593-a19d-8c1ccd50bd58' and coalesce(barcode, '') = '';  -- Tanktop / tanktop batik / sku 91465903
update public.variants set barcode = '684895' where id = '03f76e0b-7a12-41ab-a79c-5d95a0c7d69d' and coalesce(barcode, '') = '';  -- Jedai / jedai / sku JEDAI-JEDAI
update public.variants set barcode = '776626' where id = '04e72860-99bc-4fab-b7d0-1bbf8fb1b61f' and coalesce(barcode, '') = '';  -- Kebaya / Kebaya E / sku KEBAYA-KEBAYA-E
update public.variants set barcode = '285389' where id = '06d7b3e5-6ff8-4a4c-93d4-171977d57d93' and coalesce(barcode, '') = '';  -- Taplak / taplak bunga / sku TAPLAK-TAPLAK-BUNGA
update public.variants set barcode = '802638' where id = '081b939f-bb91-4656-9773-3c155930f39d' and coalesce(barcode, '') = '';  -- Batik / blus batik / sku BATIK-BLUS-BATIK
update public.variants set barcode = '652544' where id = '0848c41f-f0e2-4268-b7d4-d43687f9a201' and coalesce(barcode, '') = '';  -- Bandana / Bandana / sku BANDANA-BANDANA
update public.variants set barcode = '924235' where id = '086159ba-a539-4c73-80c2-22b1f453d54d' and coalesce(barcode, '') = '';  -- Tas / tas / sku TAS-TAS
update public.variants set barcode = '745650' where id = '092a1fd5-9c9f-4e62-ac69-f72024ddd25d' and coalesce(barcode, '') = '';  -- Batik Vest / Vest Lan / sku (kosong)
update public.variants set barcode = '713882' where id = '0a99354d-4c0c-4775-b654-53e70319592c' and coalesce(barcode, '') = '';  -- Selendang / Selendang Malay / sku SELENDANG-SELENDANG-P
update public.variants set barcode = '902210' where id = '0ae97fe7-78b7-446e-bd1c-f247988ccd77' and coalesce(barcode, '') = '';  -- Kalung / kalung 75 / sku 38148608
update public.variants set barcode = '990728' where id = '0c0945a5-4c8f-43b8-b197-d657ab3ad13e' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 90 / sku KEBAYA-KEBAYA-KUTANG
update public.variants set barcode = '575375' where id = '11d94cfa-c1c8-4b6d-b6ef-5453e839e055' and coalesce(barcode, '') = '';  -- Kain / Print / sku KAIN-KAIN-PRINT
update public.variants set barcode = '397505' where id = '12ff62a0-4c93-49ac-abc4-70a747f03735' and coalesce(barcode, '') = '';  -- Kain / Viscose / sku KAIN-KAIN-VISCOSE
update public.variants set barcode = '382361' where id = '15f34a54-1e0d-4ad5-a9f2-d0cae9016a4a' and coalesce(barcode, '') = '';  -- Kebaya / Kebaya 60 / sku 31600768
update public.variants set barcode = '784017' where id = '17039075-6825-4a3f-92a4-d12ac4a19414' and coalesce(barcode, '') = '';  -- Manik / manik giok / sku MANIK-MANIK-GIOK
update public.variants set barcode = '158261' where id = '190dec38-1fd1-4924-b458-0e78d326f0a3' and coalesce(barcode, '') = '';  -- Anting / pppp / sku (kosong)
update public.variants set barcode = '133871' where id = '19567ddb-fcb8-4237-90cf-f1cee36e0a02' and coalesce(barcode, '') = '';  -- Kain / Lilit / sku KAIN-KAIN-LILIT
update public.variants set barcode = '516068' where id = '19c38c3d-b725-4c39-a096-e1df4240cf05' and coalesce(barcode, '') = '';  -- Kebaya / kebaya janggan / sku KEBAYA-KEBAYA-JANGGAN
update public.variants set barcode = '249146' where id = '1c1c2338-cf5a-4431-ae43-69503b0b1fd2' and coalesce(barcode, '') = '';  -- Ring / ring / sku RING-RING
update public.variants set barcode = '202565' where id = '1d861a9a-0a00-42b3-9fa1-d6bd8f855b90' and coalesce(barcode, '') = '';  -- Cincin / Cincin Perak M / sku CINCIN-CINCIN-PERAK-M
update public.variants set barcode = '776709' where id = '1d917e5c-38d4-4241-9254-5bf04dbcf7a7' and coalesce(barcode, '') = '';  -- Post Card / Post Card / sku POST-CARD-POST-CARD
update public.variants set barcode = '738931' where id = '1fc1f8cb-f11d-4163-af98-8f5c0a9ce19b' and coalesce(barcode, '') = '';  -- Cincin / Cincin Perak S / sku CINCIN-CINCIN-PERAK-S
update public.variants set barcode = '913320' where id = '1fea69fd-3ddd-4dd6-aa72-403a873714e5' and coalesce(barcode, '') = '';  -- Kain / kain msu / sku KAIN-KAIN-MSU
update public.variants set barcode = '593435' where id = '2062b440-9874-4e04-9105-b684fbc17f85' and coalesce(barcode, '') = '';  -- Batik / Top Batik P / sku BATIK-TOP-BATIK-P
update public.variants set barcode = '666641' where id = '24721143-66f8-4893-b15d-baf0f0c36a77' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 140 / sku KEBAYA-KEBAYA-D
update public.variants set barcode = '283975' where id = '24e76569-3fa6-4a3b-9228-bce92c1e0bd6' and coalesce(barcode, '') = '';  -- Taplak / taplak kecil / sku TAPLAK-TAPLAK-KECIL
update public.variants set barcode = '430255' where id = '24f99b65-b52b-4e8c-bf3e-4ae81d1c8bee' and coalesce(barcode, '') = '';  -- Kain / kain hitam / sku KAIN-KAIN-HITAM
update public.variants set barcode = '876747' where id = '27efbf32-6605-4a91-8efc-7127ac1b35c0' and coalesce(barcode, '') = '';  -- Kutang / Kutang Batik / sku KUTANG-KUTANG-BATIK
update public.variants set barcode = '546756' where id = '289f9658-155b-453a-b57a-499a0745022d' and coalesce(barcode, '') = '';  -- Kebaya / Kebaya Bali / sku KEBAYA-KEBAYA-BALI
update public.variants set barcode = '975378' where id = '2ab3af65-eaba-4c1c-a9b8-8b998d955d84' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 75 / sku 43024551
update public.variants set barcode = '102909' where id = '2b90efdf-ed9a-43b5-98d1-c134ad56b9c0' and coalesce(barcode, '') = '';  -- Anting / anting 100 / sku ANTING-ANTING-L
update public.variants set barcode = '963018' where id = '2fdcdeb4-000b-4fe5-b218-04edf64dc48b' and coalesce(barcode, '') = '';  -- Kain / kain / sku KAIN-KAIN
update public.variants set barcode = '611315' where id = '34c52ae1-50a5-4c7a-852a-f00bc7990e8a' and coalesce(barcode, '') = '';  -- Konde / tusuk konde / sku KONDE-KONDE
update public.variants set barcode = '528964' where id = '3590747f-d1b6-4f79-84d7-94948d58d4c1' and coalesce(barcode, '') = '';  -- Kain / Paris / sku KAIN-KAIN-PARIS
update public.variants set barcode = '450011' where id = '366f981f-5a66-4950-beb0-f93c5561f14c' and coalesce(barcode, '') = '';  -- Kebaya / kebaya formal / sku KEBAYA-KEBAYA-FORMAL
update public.variants set barcode = '914047' where id = '3707672c-53bf-468f-be34-fafd7efbf1fb' and coalesce(barcode, '') = '';  -- Batik / batik cap / sku BATIK-BATIK-CAP
update public.variants set barcode = '683033' where id = '39f25baf-0e68-42d4-a3ff-c61fe756f66c' and coalesce(barcode, '') = '';  -- Kebaya / kebaya batik / sku KEBAYA-KEBAYA-BATIK
update public.variants set barcode = '193314' where id = '3a0b0e44-61b5-4f39-8795-16804c0abc0a' and coalesce(barcode, '') = '';  -- Anting / Anting / sku ANTING-ANTING
update public.variants set barcode = '281419' where id = '3a398644-038b-487f-a15f-8d417afc40f6' and coalesce(barcode, '') = '';  -- Tulips / tulips / sku 38296585
update public.variants set barcode = '436232' where id = '3ab64710-eca1-4773-8ef7-1900c80d628d' and coalesce(barcode, '') = '';  -- Kutang / Kutang Batik / sku 64083197
update public.variants set barcode = '335957' where id = '3c4d74d3-0037-4e1c-9091-6baa8794b92d' and coalesce(barcode, '') = '';  -- Batik / Batik Top / sku BATIK-BATIK-TOP
update public.variants set barcode = '804599' where id = '3c90cd24-198c-42fd-9e03-27e411544350' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 100 / sku KEBAYA-KEBAYA-O
update public.variants set barcode = '350958' where id = '3fde88d5-6c1b-4df1-8c9a-deeb970c174f' and coalesce(barcode, '') = '';  -- Gelang / Gelang / sku GELANG-GELANG
update public.variants set barcode = '795772' where id = '404c38ee-5449-4711-b1f0-f8c4488f24da' and coalesce(barcode, '') = '';  -- Rok / Rok / sku ROK-ROK
update public.variants set barcode = '262138' where id = '426c94e6-1be9-4c59-8cbf-2eca44e29075' and coalesce(barcode, '') = '';  -- Batik / Batik eka / sku BATIK-BATIK-EKA
update public.variants set barcode = '506336' where id = '42cf9de4-662b-44be-a0c3-0035702602f3' and coalesce(barcode, '') = '';  -- Kebaya / Kebaya S / sku KEBAYA-KEBAYA-S
update public.variants set barcode = '755771' where id = '46c102e1-b398-47db-bec6-8c18d27d05e4' and coalesce(barcode, '') = '';  -- Rok / rok lilit / sku ROK-ROK-LILIT
update public.variants set barcode = '641567' where id = '47677d31-3a75-49f3-9f65-89d147df8080' and coalesce(barcode, '') = '';  -- Tanktop / tanktop / sku TANKTOP-TANKTOP
update public.variants set barcode = '684895' where id = '4849f5ca-cccd-4130-bba6-c169c27e84c2' and coalesce(barcode, '') = '';  -- Jedai / jedai / sku JEDAI-JEDAI
update public.variants set barcode = '880521' where id = '48568f17-bd4f-4f0c-88f6-9b777a7d30d9' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 125 / sku KEBAYA-KEBAYA
update public.variants set barcode = '325431' where id = '49dd8b44-e53c-4193-b809-577d585c318e' and coalesce(barcode, '') = '';  -- Batik Vest / Vest Jumputan / sku 27965188
update public.variants set barcode = '638288' where id = '4b7081f6-bb9c-4b62-bd17-f016a019f8f7' and coalesce(barcode, '') = '';  -- Kutang / Kutang Suroso / sku KUTANG-KUTANG-SUROSO
update public.variants set barcode = '843949' where id = '4d713ccb-438d-43ad-8b52-cb6f47bc09d6' and coalesce(barcode, '') = '';  -- Sewa / sewa bawahan / sku SEWA-SEWA-BAWAHAN
update public.variants set barcode = '777793' where id = '50df9ecb-df04-4dd6-a502-8f44197098bf' and coalesce(barcode, '') = '';  -- Kemben / kemben / sku KEMBEN-KEMBEN
update public.variants set barcode = '130173' where id = '5388659a-9c7f-44a0-909d-729560bfdfc3' and coalesce(barcode, '') = '';  -- Sewa / sewa obi / sku SEWA-SEWA-OBI
update public.variants set barcode = '283043' where id = '557af1c6-f737-4a6b-b37d-4d0e15e83a4a' and coalesce(barcode, '') = '';  -- Batik / Batik 250 / sku 97326888
update public.variants set barcode = '483313' where id = '55c50619-f0f6-4733-90a7-263ef54ff2d7' and coalesce(barcode, '') = '';  -- Scrunchie / scrunchie / sku SCRUNCHIE-SCRUNCHIE
update public.variants set barcode = '490713' where id = '5952a937-5ab1-4dab-9d06-6e0c6cb057b8' and coalesce(barcode, '') = '';  -- Rok / rok sutra / sku ROK-ROK-SUTRA
update public.variants set barcode = '893679' where id = '59530233-eb48-4928-ba4f-dc0f47af93e6' and coalesce(barcode, '') = '';  -- Anting / Anting S / sku ANTING-ANTING-S
update public.variants set barcode = '425194' where id = '596e24ae-b817-4ff4-b0b8-eb874fbf1efb' and coalesce(barcode, '') = '';  -- Anting / Anting M / sku ANTING-ANTING-M
update public.variants set barcode = '283301' where id = '5a5e3a8d-80dd-4495-9a2e-871f803fd24d' and coalesce(barcode, '') = '';  -- Rok / rok selendang / sku ROK-ROK-SELENDANG
update public.variants set barcode = '355750' where id = '5ac32737-9ed0-4c69-911e-72a56cfab6c8' and coalesce(barcode, '') = '';  -- Selendang / selendang sutra / sku SELENDANG-SELENDANG-SUTRA
update public.variants set barcode = '425194' where id = '5cdc53c2-70f1-40e3-a7e3-6f424fa9c3dd' and coalesce(barcode, '') = '';  -- Anting / Anting 75 / sku ANTING-ANTING-M
update public.variants set barcode = '862514' where id = '6093cf3a-ecac-40cb-b98c-9aea81ae6cd8' and coalesce(barcode, '') = '';  -- Kebaya / liora / sku KEBAYA-KEBAYA-LIORA
update public.variants set barcode = '502243' where id = '60d8e371-f19f-4cd3-b129-28da2db9fa94' and coalesce(barcode, '') = '';  -- Anting / anting 25 / sku 80245979
update public.variants set barcode = '313617' where id = '626e5824-0fd9-4de3-b9c7-1ba2fa4b1ab8' and coalesce(barcode, '') = '';  -- Kebaya / kebaya eka / sku 41764605
update public.variants set barcode = '102909' where id = '62d1c038-1eaa-4461-805f-ec8a2b865b0c' and coalesce(barcode, '') = '';  -- Anting / anting l / sku ANTING-ANTING-L
update public.variants set barcode = '781103' where id = '65310a90-9f16-4c67-82c2-7ff743b7e75e' and coalesce(barcode, '') = '';  -- Bros / bros renteng / sku 89594801
update public.variants set barcode = '513130' where id = '66251ab9-a9f9-4062-92bb-4b5890d26e51' and coalesce(barcode, '') = '';  -- Jam / jam / sku JAM-JAM
update public.variants set barcode = '317719' where id = '674f49e2-a557-4401-ad67-b0b14f5a3015' and coalesce(barcode, '') = '';  -- Anting / anting 35 / sku 58191901
update public.variants set barcode = '310495' where id = '684f9812-8c86-4cbb-8336-392fb3292a9a' and coalesce(barcode, '') = '';  -- Katbol / katbol / sku 89452729
update public.variants set barcode = '326041' where id = '6b9ea077-1843-4932-9b1b-da9ceb0221a5' and coalesce(barcode, '') = '';  -- Kemeja Cowok / kemeja cowok / sku KEMEJA-COWOK-KEMEJA-COWOK
update public.variants set barcode = '989404' where id = '6c441ba6-60a7-4959-8dcd-bf22b395e755' and coalesce(barcode, '') = '';  -- Manik / Manik / sku MANIK-MANIK
update public.variants set barcode = '785913' where id = '6e9c4930-5301-4604-91c6-6a7ef38d5468' and coalesce(barcode, '') = '';  -- Daster / Daster / sku DASTER-DASTER
update public.variants set barcode = '467752' where id = '6ea18e9d-c69a-45a4-8cc0-b98b071108e8' and coalesce(barcode, '') = '';  -- TES-B2 Kebaya / Seri A / sku TES-B2-V
update public.variants set barcode = '257772' where id = '706f25a2-2180-4478-91fa-9437502e8ad8' and coalesce(barcode, '') = '';  -- Bros / bros 10 / sku 89245202
update public.variants set barcode = '350438' where id = '786fb997-a303-4ad6-99a2-2ca5520ca6ac' and coalesce(barcode, '') = '';  -- Anting / anting 50 / sku 48516715
update public.variants set barcode = '209463' where id = '788bfbca-a57b-4627-b69c-d3e8c8650cb1' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 120 / sku KEBAYA-KEBAYA-A
update public.variants set barcode = '285702' where id = '78ed8454-cb25-4a6b-b5d7-fdf2e111e574' and coalesce(barcode, '') = '';  -- Selendang / Selendang / sku SELENDANG-SELENDANG
update public.variants set barcode = '921331' where id = '79974651-0837-4535-ab26-b0d0aee22ac4' and coalesce(barcode, '') = '';  -- Bagcharm / BC Tulip / sku (kosong)
update public.variants set barcode = '708315' where id = '7d22ea7a-b184-4bf7-81e2-1bde6f716435' and coalesce(barcode, '') = '';  -- Dompet / dompet / sku DOMPET-DOMPET
update public.variants set barcode = '699311' where id = '7fcbfbb2-d104-4500-aca5-cd97e6ed8fe2' and coalesce(barcode, '') = '';  -- Kain / Kain Encim / sku KAIN-KAIN-ENCIM
update public.variants set barcode = '280863' where id = '80392619-3bb4-41d2-ab8c-88d9de4c6416' and coalesce(barcode, '') = '';  -- Dres / dres / sku DRES-DRES
update public.variants set barcode = '974065' where id = '83caf8f9-d669-47cc-a4ed-69930789455b' and coalesce(barcode, '') = '';  -- Cincin / Cincin Perak L / sku CINCIN-CINCIN-PERAK-L
update public.variants set barcode = '509550' where id = '8451b599-7363-490f-8a9a-8019a4e47a22' and coalesce(barcode, '') = '';  -- Cincin / cincin s / sku CINCIN-CINCIN-S
update public.variants set barcode = '825241' where id = '84c7cf79-d75d-4530-b3f2-44c37f50e15b' and coalesce(barcode, '') = '';  -- Tam Newman / tam newman / sku TAM-NEWMAN-TAM-NEWMAN
update public.variants set barcode = '233732' where id = '862aa3ff-bbe0-4dcf-9e50-5909eb7c5a4e' and coalesce(barcode, '') = '';  -- Cincin / cincin 50 / sku CINCIN-CINCIN-2
update public.variants set barcode = '646678' where id = '8a78f691-189f-4fb4-81aa-916f241cdf9c' and coalesce(barcode, '') = '';  -- Longtorso / longtorso / sku LONGTORSO-LONGTORSO
update public.variants set barcode = '887947' where id = '8c97eddb-2a8d-40a1-b448-ae59edfae2b2' and coalesce(barcode, '') = '';  -- Sarung Bantal / sarung bantal / sku SARUNG-BANTAL-SARUNG-BANTAL
update public.variants set barcode = '502703' where id = '8e255d0e-3e3c-4bf8-8483-42960913d484' and coalesce(barcode, '') = '';  -- Kebaya / kebaya tunik / sku 47170605
update public.variants set barcode = '604112' where id = '8f499265-8dc9-46ff-8af8-c5e7b5f5d0af' and coalesce(barcode, '') = '';  -- Batik / batik tulis / sku BATIK-BATIK-TULIS
update public.variants set barcode = '974081' where id = '91dcca3b-c90d-46be-a40c-db6dd90fad40' and coalesce(barcode, '') = '';  -- Obi / Obi Viscose / sku OBI-OBI-VISCOSE
update public.variants set barcode = '323171' where id = '92111994-7df5-4b9d-80e6-a1f9c987465d' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 80 / sku 69414983
update public.variants set barcode = '407837' where id = '958726de-56e2-4af0-b414-119004716803' and coalesce(barcode, '') = '';  -- Batik / batik oversize / sku BATIK-BATIK-OVERSIZE
update public.variants set barcode = '511509' where id = '99bfc38b-e41a-496f-a339-0a0f6d7ea115' and coalesce(barcode, '') = '';  -- Kebaya / kebaya ilora / sku KEBAYA-KEBAYA-ILORA
update public.variants set barcode = '479442' where id = '9b70726e-020c-4e49-888d-b66ea73af23d' and coalesce(barcode, '') = '';  -- Batik / Top Batik / sku BATIK-TOP-BATIK
update public.variants set barcode = '765725' where id = 'a0167c64-83fb-4e93-b7bb-5fe3de0952a9' and coalesce(barcode, '') = '';  -- Kebaya / sewa kebaya / sku KEBAYA-SEWA-KEBAYA
update public.variants set barcode = '749151' where id = 'a14607d7-1173-4636-a40b-f9015db7ae92' and coalesce(barcode, '') = '';  -- Cincin / cincin 15 / sku CINCIN-CINCIN
update public.variants set barcode = '182861' where id = 'a227eca3-2058-4240-994b-61948bc6d618' and coalesce(barcode, '') = '';  -- Manset / manset / sku MANSET-MANSET
update public.variants set barcode = '605873' where id = 'a30d35bd-b294-499e-bded-9e192ae12fcd' and coalesce(barcode, '') = '';  -- Cincin / cincin cowok / sku CINCIN-CINCIN-COWOK
update public.variants set barcode = '118480' where id = 'a5bdddfe-97aa-49fb-b6ec-709785824706' and coalesce(barcode, '') = '';  -- Kain / Jarik Lawasan / sku KAIN-JARIK-LAWASAN
update public.variants set barcode = '531467' where id = 'a6daceb1-7c1e-4fb7-b121-78faaad9d4fa' and coalesce(barcode, '') = '';  -- Kutang / Kutang / sku KUTANG-KUTANG
update public.variants set barcode = '742302' where id = 'a7395d7c-eb70-4a5b-a382-20fb396819a4' and coalesce(barcode, '') = '';  -- Kebaya / Floral / sku 35406331
update public.variants set barcode = '937514' where id = 'a77c5aec-006d-4e4d-8db9-89a51c549505' and coalesce(barcode, '') = '';  -- Tas / tas tepung / sku TAS-TAS-TEPUNG
update public.variants set barcode = '193314' where id = 'a7c78578-d681-4641-b4c5-f0a9967151f3' and coalesce(barcode, '') = '';  -- Anting / Anting XL / sku ANTING-ANTING
update public.variants set barcode = '323426' where id = 'a825020f-2414-4d69-a5e6-c58ba38bd492' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 135 / sku KEBAYA-KEBAYA-C
update public.variants set barcode = '550900' where id = 'a89bd00c-b904-43f8-a535-601133ad40c0' and coalesce(barcode, '') = '';  -- Kain / kain batik / sku KAIN-KAIN-BATIK
update public.variants set barcode = '357498' where id = 'ad06709b-2253-47d0-a58f-f5c8432377ec' and coalesce(barcode, '') = '';  -- Tulip / Tulip / sku TULIP-TULIP
update public.variants set barcode = '289716' where id = 'b2650e5a-cef4-4bdf-9ed0-cd8d7c48ac4c' and coalesce(barcode, '') = '';  -- Outer / outer / sku OUTER-OUTER
update public.variants set barcode = '180375' where id = 'b2ea82d8-a2fe-4cab-92b3-e7c5de8faf27' and coalesce(barcode, '') = '';  -- Magnet / magnet / sku MAGNET-MAGNET
update public.variants set barcode = '144698' where id = 'b8b6a296-b0da-4455-b337-66b2dcdd560c' and coalesce(barcode, '') = '';  -- Kebaya / kebaya bunga / sku KEBAYA-KEBAYA-BUNGA
update public.variants set barcode = '429477' where id = 'b9795f1e-e03b-4e46-aacd-d27a6e6474ad' and coalesce(barcode, '') = '';  -- Kalung / kalung / sku KALUNG-KALUNG
update public.variants set barcode = '630898' where id = 'b97e935c-6e75-487d-8927-0fe15de7fa78' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 110 / sku 51728304
update public.variants set barcode = '412669' where id = 'ba9db150-4eab-4fd3-a8fa-d2c0807911cd' and coalesce(barcode, '') = '';  -- Daster / daster batik / sku DASTER-DASTER-BATIK
update public.variants set barcode = '632478' where id = 'bba35b4f-1514-4542-acc0-a4585c722601' and coalesce(barcode, '') = '';  -- Tunik / tunik / sku TUNIK-TUNIK
update public.variants set barcode = '903038' where id = 'bdded86c-73d3-4a71-8822-ed8b466808d9' and coalesce(barcode, '') = '';  -- Batik / batik / sku BATIK-BATIK
update public.variants set barcode = '991252' where id = 'bf29dd4e-fdab-4a1f-b180-d2de07703e88' and coalesce(barcode, '') = '';  -- Bc / BC / sku BC-BC
update public.variants set barcode = '489998' where id = 'bfa47e16-6744-4d1a-b9f0-bc528350efaf' and coalesce(barcode, '') = '';  -- Ganci / ganci / sku GANCI-GANCI
update public.variants set barcode = '933630' where id = 'c49a8859-1e0c-4340-b00d-644afa9ebd48' and coalesce(barcode, '') = '';  -- Taplak / taplak batik / sku TAPLAK-TAPLAK-BATIK
update public.variants set barcode = '468467' where id = 'c5a55f76-4de0-4721-ad44-b32ce67ecab1' and coalesce(barcode, '') = '';  -- Taplak / taplak / sku TAPLAK-TAPLAK
update public.variants set barcode = '188856' where id = 'c70703b1-4a13-4106-804c-c0be9a57d3c8' and coalesce(barcode, '') = '';  -- Giwang / giwang / sku GIWANG-GIWANG
update public.variants set barcode = '812564' where id = 'c73fc9d8-422c-4fe6-89e3-e3fd39e3388b' and coalesce(barcode, '') = '';  -- Curated / Curated / sku CURATED-CURATED
update public.variants set barcode = '304550' where id = 'c7639c88-e2ab-4d3c-8e51-a133953d8d30' and coalesce(barcode, '') = '';  -- Gelang / Gelang 15 / sku GELANG-GELANG-E
update public.variants set barcode = '443405' where id = 'c80d24c6-dc1f-4b73-9b56-c8fa7ea8269b' and coalesce(barcode, '') = '';  -- Bros / bros janggan / sku BROS-BROS
update public.variants set barcode = '979164' where id = 'c8bbf353-3323-4531-94ce-b5161c98918f' and coalesce(barcode, '') = '';  -- Tas / tas koin / sku TAS-TAS-KOIN
update public.variants set barcode = '505842' where id = 'c8f45fe8-02b2-4066-b963-a1750420e559' and coalesce(barcode, '') = '';  -- Bustier / Bustier / sku BUSTIER-BUSTIER
update public.variants set barcode = '513130' where id = 'c90bdac4-0ac3-4854-8316-6425d236e47f' and coalesce(barcode, '') = '';  -- Jam / jam / sku JAM-JAM
update public.variants set barcode = '576126' where id = 'ca318937-9164-4d93-b459-22d00f9dc13b' and coalesce(barcode, '') = '';  -- Kain / Kain Katun / sku KAIN-KAIN-KATUN
update public.variants set barcode = '251656' where id = 'caa16623-eaca-4a40-a02e-a48c6c1cf8ad' and coalesce(barcode, '') = '';  -- Kamisol / Kamisol / sku KAMISOL-KAMISOL
update public.variants set barcode = '972902' where id = 'cab30b05-a892-491c-8583-4e3064a68650' and coalesce(barcode, '') = '';  -- Curated / curated man / sku CURATED-CURATED-MAN
update public.variants set barcode = '893679' where id = 'cb730b9c-2d8a-4bd5-b59e-30a2c1a0f4df' and coalesce(barcode, '') = '';  -- Anting / Anting S / sku ANTING-ANTING-S
update public.variants set barcode = '453303' where id = 'cf53bcd5-4e8b-474c-ad55-ebaff5d85320' and coalesce(barcode, '') = '';  -- Scruncie / Scruncie / sku SCRUNCIE-SCRUNCIE
update public.variants set barcode = '964977' where id = 'd08a74a2-81cd-451d-a761-9d10fd3c7d55' and coalesce(barcode, '') = '';  -- Kain / kain coklat / sku KAIN-KAIN-COKLAT
update public.variants set barcode = '505842' where id = 'd386113a-7ef4-4ed0-bb9f-00620a9b2570' and coalesce(barcode, '') = '';  -- Bustier / Bustier / sku BUSTIER-BUSTIER
update public.variants set barcode = '612734' where id = 'd6f923fe-bddd-42e8-9d35-d0b3a9c5e1a4' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 130 / sku KEBAYA-KEBAYA-B
update public.variants set barcode = '240077' where id = 'dc0a503d-1654-4a19-8313-6ed8cf5f9d17' and coalesce(barcode, '') = '';  -- Kain / kain MU / sku KAIN-KAIN-MU
update public.variants set barcode = '408888' where id = 'dd9985da-5854-4b74-adc5-194ac611909e' and coalesce(barcode, '') = '';  -- Tas / Tas Segitiga / sku TAS-TAS-SEGITIGA
update public.variants set barcode = '940731' where id = 'ded70ca5-0144-4062-a755-020f959b082b' and coalesce(barcode, '') = '';  -- Kebaya / kebaya bunga s / sku KEBAYA-KEBAYA-BUNGA-S
update public.variants set barcode = '262971' where id = 'df3c59a5-431f-4520-9ca3-c01c4bc062b0' and coalesce(barcode, '') = '';  -- Kim / Kim / sku KIM-KIM
update public.variants set barcode = '661678' where id = 'df4957ad-b391-4a62-925d-a7495f78f9ae' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 150 / sku KEBAYA-KEBAYA-P
update public.variants set barcode = '734560' where id = 'e2064973-1e04-405e-b171-49d14f9511dd' and coalesce(barcode, '') = '';  -- Kebaya / Kebaya Encim / sku KEBAYA-KEBAYA-ENCIM
update public.variants set barcode = '210922' where id = 'e3be9f52-72a3-4a08-9427-eac4961d83e2' and coalesce(barcode, '') = '';  -- Sarasvati / Sarasvati / sku 16556461
update public.variants set barcode = '753959' where id = 'e874b80f-3191-4cea-99be-0a1d53cad9b6' and coalesce(barcode, '') = '';  -- Cincin / cincin / sku 72648093
update public.variants set barcode = '774412' where id = 'e878d225-24d8-4579-a559-2a2db6ba739b' and coalesce(barcode, '') = '';  -- Kebaya / kebaya illora / sku KEBAYA-KEBAYA-ILLORA
update public.variants set barcode = '949894' where id = 'eb08def8-4684-45b8-a019-a12a27ba500e' and coalesce(barcode, '') = '';  -- Sewa / sewa set / sku SEWA-SEWA-SET
update public.variants set barcode = '388385' where id = 'ed5c9aa4-d021-4961-8327-dbd8affb7497' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 175 / sku KEBAYA-KEBAYA-ANAK
update public.variants set barcode = '326041' where id = 'ee358dcc-8398-4ca0-9223-782d48504edb' and coalesce(barcode, '') = '';  -- Kemeja Cowok / kemeja cowok / sku KEMEJA-COWOK-KEMEJA-COWOK
update public.variants set barcode = '380326' where id = 'ef0d37f8-8122-4be7-8477-b3124fa3a58b' and coalesce(barcode, '') = '';  -- Obi / Obi Biasa / sku OBI-OBI-BIASA
update public.variants set barcode = '982733' where id = 'f0a5cdd5-003d-4bee-9ca0-1f539c164af1' and coalesce(barcode, '') = '';  -- Kebaya / kebaya 115 / sku KEBAYA-KEBAYA-K
update public.variants set barcode = '955151' where id = 'f2a92e6d-1633-4d67-88e4-a30dce06028c' and coalesce(barcode, '') = '';  -- Batik Vest / Vest / sku VEST-VEST
update public.variants set barcode = '119340' where id = 'f560708d-e73d-4042-b3df-ff1fbeaa0241' and coalesce(barcode, '') = '';  -- Gelang / gelang batu / sku GELANG-GELANG-BATU
update public.variants set barcode = '161071' where id = 'f5c7a56c-d8ab-4462-b485-5bbd879e3035' and coalesce(barcode, '') = '';  -- Batik / batik s / sku BATIK-BATIK-S
update public.variants set barcode = '711399' where id = 'f6681f98-e77c-46ab-8b19-386ae1da1db4' and coalesce(barcode, '') = '';  -- Obi / Obi besar / sku OBI-OBI-KERAS
update public.variants set barcode = '140790' where id = 'f849c048-0828-4b5f-8c4f-78ad9ba419ee' and coalesce(barcode, '') = '';  -- Kain / Rayon / sku 80351672
update public.variants set barcode = '669628' where id = 'f90cba92-6f63-4852-a805-3a710f26a6f2' and coalesce(barcode, '') = '';  -- Taplak / taplak besar / sku TAPLAK-TAPLAK-BESAR
update public.variants set barcode = '252570' where id = 'f991eba1-e80e-4bc4-8555-b237cbeb515a' and coalesce(barcode, '') = '';  -- Kain / kain sutra / sku KAIN-KAIN-SUTRA
update public.variants set barcode = '497347' where id = 'ff920082-1168-415b-a0c8-080e2e63c4ba' and coalesce(barcode, '') = '';  -- Kebaya / Kebaya Lawasan / sku KEBAYA-KEBAYA-LAWASAN
commit;
