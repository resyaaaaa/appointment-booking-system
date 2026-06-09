import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase Client with service role key for admin access
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// API Endpoint to book an appointment
app.post('/api/appointments', async (expressReq, expressRes) => {
  const { clientId, serviceId, appointmentTime } = expressReq.body;

  try {
    // 1. Check if slot is already taken
    const { data: existingSlot, error: checkError } = await supabase
      .from('appointments')
      .select('id')
      .eq('appointment_time', appointmentTime)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingSlot) {
      return expressRes.status(400).json({ error: 'This time slot is already booked.' });
    }

    // 2. Insert new appointment
    const { data, error: insertError } = await supabase
      .from('appointments')
      .insert([{ client_id: clientId, service_id: serviceId, appointment_time: appointmentTime, status: 'confirmed' }])
      .select();

    if (insertError) throw insertError;

    return expressRes.status(201).json({ success: true, appointment: data[0] });
  } catch (err) {
    return expressRes.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
