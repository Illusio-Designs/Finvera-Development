import React, { memo } from 'react';
import Casestudy from '../Casestudy';

const CaseStudySection = memo(() => {
  return (
    <div className="casestudy">
      <div className="casestudy-content">
        <p>Our Work</p>
        <h1>Real Cases. Real Results.</h1>
      </div>
      <Casestudy />
    </div>
  );
});

CaseStudySection.displayName = 'CaseStudySection';

export default CaseStudySection;

