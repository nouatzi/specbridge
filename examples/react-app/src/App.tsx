import { Button } from './components/Button';
import { useCounter } from './hooks/useCounter';

function App() {
  const { count, increment, decrement, reset } = useCounter(0);

  return (
    <div style={{ padding: '20px' }}>
      <h1>SpecBridge React Example</h1>
      <p>Count: {count}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Button label="Increment" onClick={increment} variant="primary" />
        <Button label="Decrement" onClick={decrement} variant="secondary" />
        <Button label="Reset" onClick={reset} variant="secondary" />
      </div>
    </div>
  );
}

export default App;
