import { h } from 'preact';
import { useState } from 'preact/hooks';
import { parseLogFile, analyzeLog } from '../logic/LogParser';
import TelemetryChart from './TelemetryChart';

const LogAnalyzer = () => {
  const [logData, setLogData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await parseLogFile(file);
      const analysis = analyzeLog(data);
      setLogData(data);
      setSummary(analysis);
    } catch (error) {
      console.error("Error parsing log:", error);
      alert("Failed to parse log file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="log-analyzer" style={{ padding: '20px', color: '#eee' }}>
      <header style={{ marginBottom: '30px' }}>
        <h2 style={{ margin: 0, color: '#00ccff' }}>Telemetry Analysis Engine</h2>
        <p style={{ color: '#888' }}>Visualize and analyze EUC logs</p>
        
        <div style={{ marginTop: '20px' }}>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            id="log-upload"
            style={{ display: 'none' }}
          />
          <label 
            htmlFor="log-upload"
            style={{
              padding: '10px 20px',
              background: '#333',
              border: '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-block',
              transition: 'background 0.3s'
            }}
            onMouseOver={(e) => e.target.style.background = '#444'}
            onMouseOut={(e) => e.target.style.background = '#333'}
          >
            {loading ? 'Processing...' : 'Upload Telemetry CSV'}
          </label>
        </div>
      </header>

      {summary && (
        <div style={{ marginBottom: '30px' }}>
          <div className="summary-cards" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '15px',
            marginBottom: '20px'
          }}>
            <SummaryCard label="Max Speed" value={`${summary?.maxSpeed?.toFixed(2) || '0.00'} km/h`} />
            <SummaryCard label="Max Power" value={`${((summary?.maxPower || 0) / 1000).toFixed(2)} kW`} />
            <SummaryCard label="Max PWM" value={`${summary?.maxPWM?.toFixed(1) || '0.0'} %`} />
            <SummaryCard label="Min Voltage" value={`${summary?.minVoltage?.toFixed(1) || '0.0'} V`} color="#ff3366" />
            <SummaryCard label="Avg Voltage" value={`${summary?.avgVoltage?.toFixed(1) || '0.0'} V`} />
            <SummaryCard label="Max Tilt/Roll" value={`${summary?.maxTilt?.toFixed(1) || '0.0'}° / ${summary?.maxRoll?.toFixed(1) || '0.0'}°`} />
          </div>
          
          <div className="insights" style={{ background: '#1e1e1e', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #ffcc00' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#ffcc00' }}>Analysis Insights</h4>
            <p style={{ margin: 0, fontSize: '14px', color: '#ccc' }}>
              Detected a maximum voltage sag of <strong>{( (summary?.avgVoltage || 0) - (summary?.minVoltage || 0) ).toFixed(1)}V</strong> from average. 
              The system reached <strong>{summary?.maxPWM?.toFixed(1) || '0.0'}%</strong> PWM utilization, which indicates {(summary?.maxPWM > 80) ? 'high load approaching limits' : 'safe headroom'}.
            </p>
          </div>
        </div>
      )}

      {logData.length > 0 && (
        <div className="charts-container" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <TelemetryChart 
            title="Speed & PWM" 
            data={logData} 
            metrics={[
              { key: 'speed', label: 'Speed', unit: 'km/h', fill: true, showPeak: true },
              { key: 'pwm', label: 'PWM', unit: '%', yAxisIndex: 1, showPeak: true }
            ]}
            colors={['#00ccff', '#ffcc00']}
          />
          
          <TelemetryChart 
            title="Voltage & Current" 
            data={logData} 
            metrics={[
              { key: 'voltage', label: 'Voltage', unit: 'V', showPeak: false },
              { key: 'current', label: 'Battery Current', unit: 'A', yAxisIndex: 1, showPeak: true }
            ]}
            colors={['#ff3366', '#33ff99']}
          />

          <TelemetryChart 
            title="Phase Current & Temperature" 
            data={logData} 
            metrics={[
              { key: 'phase_current', label: 'Phase Current', unit: 'A', showPeak: true },
              { key: 'system_temp', label: 'System Temp', unit: '°C', yAxisIndex: 1, showPeak: true }
            ]}
            colors={['#9966ff', '#ff9933']}
          />
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, color }) => (
  <div style={{
    background: '#1e1e1e',
    padding: '15px',
    borderRadius: '8px',
    borderLeft: `4px solid ${color || '#00ccff'}`,
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
  }}>
    <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
  </div>
);

export default LogAnalyzer;
