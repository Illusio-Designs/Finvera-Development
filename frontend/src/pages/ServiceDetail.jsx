import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import ServiceDetailPage from '../components/ServiceDetailPage';
import { serviceData } from '../data/serviceData';

const ServiceDetail = () => {
  const { category, slug } = useParams();
  const key = `${category}/${slug}`;
  const data = serviceData[key];

  if (!data) return <Navigate to="/404" replace />;

  return <ServiceDetailPage {...data} />;
};

export default ServiceDetail;
