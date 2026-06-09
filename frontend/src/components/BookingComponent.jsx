import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import axios from 'axios';

export default function BookingComponent() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Fetch services directly from Supabase
    const fetchServices = async () => {
      const { data } = await supabase.from('services').select('*');
      setServices(data || []);
    };
    fetchServices();
  }, []);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please sign in to book appointments.');

    try {
      const response = await axios.post('http://localhost:5000/api/appointments', {
        clientId: user.id,
        serviceId: selectedService,
        appointmentTime: new Date(bookingDate).toISOString(),
      });
      
      if (response.data.success) {
        alert('Appointment secured successfully!');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Booking execution failed.');
    }
  };

  return (
    <form onSubmit={handleBooking} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px' }}>
      <h3>Schedule Appointment</h3>
      
      <select onChange={(e) => setSelectedService(e.target.value)} required>
        <option value="">Select a Service</option>
        {services.map(s => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
      </select>

      <input 
        type="datetime-local" 
        onChange={(e) => setBookingDate(e.target.value)} 
        required 
      />

      <button type="submit">Confirm Reservation</button>
    </form>
  );
}
