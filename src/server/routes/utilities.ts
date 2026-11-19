import { Router } from 'express';

const router = Router();

// India Post PIN code lookup
router.get('/pincode/:pin', async (req, res) => {
  const pin = (req.params.pin || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    res.status(400).json({ error: 'Please enter a valid 6-digit Indian PIN code.' });
    return;
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const payload = (await response.json()) as any[];
    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first || first.Status !== 'Success' || !Array.isArray(first.PostOffice) || !first.PostOffice.length) {
      res.status(404).json({ error: 'PIN code not found. Please verify and try again.' });
      return;
    }

    const po = first.PostOffice[0];
    const isMetro = ['Mumbai', 'Delhi', 'New Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune'].some(
      (c) => (po.District || '').toLowerCase().includes(c.toLowerCase()) || (po.Name || '').toLowerCase().includes(c.toLowerCase())
    );

    res.json({
      pincode: pin,
      city: po.Block && po.Block !== 'NA' ? po.Block : po.District || po.Name,
      district: po.District || '',
      state: po.State || '',
      deliveryEstimate: isMetro ? '3–5 business days' : '5–7 business days',
      codAvailable: true,
    });
  } catch {
    res.status(502).json({ error: 'Unable to verify PIN code right now. You may enter City and State manually.' });
  }
});

// Reverse geocode via OpenStreetMap Nominatim
router.get('/reverse-geocode', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: 'Invalid coordinates.' });
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ZARIFLY-Boutique/1.0 (https://zarifly.com)' },
    });
    const data = (await response.json()) as any;
    const addr = data?.address || {};

    res.json({
      streetArea: [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', '),
      city: addr.city || addr.town || addr.village || addr.county || '',
      district: addr.state_district || addr.county || '',
      state: addr.state || '',
      pincode: (addr.postcode || '').replace(/\s+/g, ''),
      landmark: addr.amenity || addr.building || '',
    });
  } catch {
    res.status(502).json({ error: 'Could not determine location address.' });
  }
});

export default router;
