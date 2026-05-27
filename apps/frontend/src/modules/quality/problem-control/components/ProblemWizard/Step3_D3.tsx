// D3 — Initial Response & Containment (combined wizard step)
import React from 'react';
import { Step3a_InitialResponse } from './Step3a_InitialResponse';
import { Step3b_Containment } from './Step3b_Containment';

export const Step3_D3: React.FC = () => (
  <>
    <Step3a_InitialResponse />
    <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '0 1.5rem' }} />
    <Step3b_Containment />
  </>
);
