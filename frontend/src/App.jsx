import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'https://mern-screen-recorder-b7ru.onrender.com/api'; 

function Recorder() {
  const [recording, setRecording] = useState(false);
  const [videoURL, setVideoURL] = useState(null);
  const [timer, setTimer] = useState(0);
  const [message, setMessage] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoURL(URL.createObjectURL(blob));
        chunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setRecording(true);
      setTimer(0);
      timerRef.current = setInterval(() => setTimer((prev) => prev + 1), 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
    setRecording(false);
  };

  useEffect(() => {
    if (timer >= 180) { // 3 minutes
      stopRecording();
    }
    return () => clearInterval(timerRef.current);
  }, [timer]);

  const downloadVideo = () => {
    const a = document.createElement('a');
    a.href = videoURL;
    a.download = 'recording.webm';
    a.click();
  };

  const uploadVideo = async () => {
    if (!videoURL) return;
    const blob = await fetch(videoURL).then((res) => res.blob());
    const formData = new FormData();
    formData.append('video', blob, 'recording.webm');
    try {
      const res = await fetch(`${API_URL}/recordings`, { method: 'POST', body: formData });
      if (res.ok) {
        setMessage('Upload successful!');
      } else {
        setMessage('Upload failed.');
      }
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Screen Recorder</h1>
      {!recording ? (
        <button className="bg-blue-500 text-white p-2" onClick={startRecording}>Start Recording</button>
      ) : (
        <button className="bg-red-500 text-white p-2" onClick={stopRecording}>Stop Recording</button>
      )}
      {recording && <p>Time: {Math.floor(timer / 60)}:{timer % 60 < 10 ? '0' : ''}{timer % 60}</p>}
      {videoURL && (
        <>
          <video src={videoURL} controls className="mt-4 w-96" />
          <button className="bg-green-500 text-white p-2 mt-2" onClick={downloadVideo}>Download</button>
          <button className="bg-purple-500 text-white p-2 mt-2 ml-2" onClick={uploadVideo}>Upload</button>
          <p>{message}</p>
        </>
      )}
    </div>
  );
}

function RecordingsList() {
  const [recordings, setRecordings] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/recordings`)
      .then((res) => res.json())
      .then(setRecordings)
      .catch(console.error);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Uploaded Recordings</h1>
      <ul>
        {recordings.map((rec) => (
          <li key={rec.id} className="mb-4">
            <p>Title: {rec.filename}, Size: {rec.filesize} bytes, Created: {rec.createdAt}</p>
            <video src={rec.url} controls className="w-96" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function App() {
  return (
    <Router>
      <nav className="bg-gray-800 text-white p-4">
        <Link to="/" className="mr-4">Recorder</Link>
        <Link to="/recordings">Recordings List</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Recorder />} />
        <Route path="/recordings" element={<RecordingsList />} />
      </Routes>
    </Router>
  );
}

export default App;