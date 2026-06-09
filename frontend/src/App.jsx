import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [user, setUser] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [message, setMessage] = useState('');

  // Handle User Auth State Change
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Slots from Node.js Backend when date changes
  useEffect(() => {
    if (!date) return;
    fetch(`http://localhost:5000/api/available-slots?date=${date}`)
      .then(res => res.json())
      .then(data => setSlots(data.availableSlots || []))
      .catch(err => console.error(err));
  }, [date]);

  // Submit Booking request to Node.js Backend
  const handleBooking = async () => {
    if (!user) return alert("Please log in to book!");
    
    const response = await fetch('http://localhost:5000/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: user.id,
        appointment_date: date,
        time_slot: selectedSlot
      })
    });

    const result = await response.json();
    if (result.success) {
      setMessage(`Success! Booked for ${date} at ${selectedSlot}`);
      setSlots(slots.filter(s => s !== selectedSlot));
    } else {
      setMessage(`Error: ${result.error}`);
    }
  };

  // Simple Anonymous Login for testing purposes
  const handleLogin = async () => {
    await supabase.auth.signInWithOtp({ email: 'testuser@example.com' });
    alert('Check email for login link!');
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Appointment Booking App</h1>
      
      {!user ? (
        <button onClick={handleLogin}>Log In / Sign Up</button>
      ) : (
        <div>
          <p>Welcome, {user.email}!</p>
          <button onClick={() => supabase.auth.signOut()}>Log Out</button>
          <hr />
          
          <h3>Pick a Date:</h3>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          {date && (
            <div>
              <h3>Available Slots:</h3>
              {slots.length === 0 ? <p>No slots available</p> : (
                slots.map(slot => (
                  <button 
                    key={slot} 
                    onClick={() => setSelectedSlot(slot)}
                    style={{ margin: '5px', backgroundColor: selectedSlot === slot ? 'lightgreen' : '' }}
                  >
                    {slot}
                  </button>
                ))
              )}
            </div>
          )}

          {selectedSlot && (
            <div style={{ marginTop: '20px' }}>
              <button onClick={handleBooking}>Confirm Appointment</button>
            </div>
          )}

          {message && <p><strong>{message}</strong></p>}
        </div>
      )}
    </div>
  );
}

export default App;
