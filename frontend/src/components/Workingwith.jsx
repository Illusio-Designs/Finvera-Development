import React, { memo } from 'react';
import '../styles/components/Workingwith.css';
import { MdVolunteerActivism } from 'react-icons/md';
import shramLogo from '../assets/shram suvidha.webp';
import lwfLogo from '../assets/labour walfare.webp';
import dishLogo from '../assets/DISH.webp';
import epfoLogo from '../assets/EPFO.webp';
import esicLogo from '../assets/ESIC.webp';

const govPortals = [
  {
    name: 'Shram Suvidha',
    url: 'https://registration.shramsuvidha.gov.in/user/login',
    icon: shramLogo,
  },
  {
    name: 'Labour Welfare Fund',
    url: 'https://glwbcrm.gujarat.gov.in/',
    icon: lwfLogo,
  },
  {
    name: 'Directorate of Industrial Safety and Health',
    url: 'https://dish.gujarat.gov.in/e-services.htm',
    icon: dishLogo,
  },
  {
    name: "Employees' State Insurance Corporation",
    url: 'https://portal.esic.gov.in/EmployerPortal/ESICInsurancePortal/Portal_Loginnew.aspx',
    icon: esicLogo,
  },
  {
    name: "Employees' Provident Fund Organisation",
    url: 'https://unifiedportal-emp.epfindia.gov.in/epfo/',
    icon: epfoLogo,
  },
];

const Workingwith = memo(() => {
  return (
    <div className="working-with">
      <div className="working-with-header">
        <span className="working-with-tag">Our Network</span>
        <h2>Government Portals We Work With</h2>
        <p>We navigate official government platforms to keep your business fully compliant</p>
      </div>
      <div className="working-with-grid">
        {govPortals.map((portal) => (
          <a
            key={portal.name}
            href={portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="gov-card"
          >
            <span className="gov-card-name">{portal.name}</span>
            <div className="gov-card-accent" />
            <div className="gov-card-icon">
              {portal.icon
                ? <img src={portal.icon} alt={portal.name} className="gov-card-logo" />
                : portal.iconFallback
              }
            </div>
            <span className="gov-card-name-bottom">{portal.name}</span>
            <div className="gov-card-arrow">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 17L17 7M17 7H7M17 7v10" stroke="#1f4f9c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
});

Workingwith.displayName = 'Workingwith';

export default Workingwith;
