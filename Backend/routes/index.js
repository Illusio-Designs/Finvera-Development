/**
 * Routes Index
 * This file centralizes all route imports and exports them as a single object
 */

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const companyRoutes = require('./companyRoutes');
const consumerRoutes = require('./consumerRoutes');
const employeeCompensationRoutes = require('./employeeCompensationRoutes');
const insuranceCompanyRoutes = require('./insuranceCompanyRoutes');
const vehiclePolicyRoutes = require('./vehiclePolicyRoutes');
const healthPolicyRoutes = require('./healthPolicyRoutes');
const firePolicyRoutes = require('./firePolicyRoutes');
const lifePolicyRoutes = require('./lifePolicyRoutes');
const dscRoutes = require('./dscRoutes');
const renewalRoutes = require('./renewalRoutes');
const dscLogRoutes = require('./dscLogRoutes');
const userRoleWorkLogRoutes = require('./userRoleWorkLogRoutes');
const factoryQuotationRoutes = require('./factoryQuotationRoutes');
const planManagementRoutes = require('./planManagementRoutes');
const stabilityManagementRoutes = require('./stabilityManagementRoutes');
const applicationManagementRoutes = require('./applicationManagementRoutes');
const renewalStatusRoutes = require('./renewalStatusRoutes');
const documentDownloadRoutes = require('./documentDownloadRoutes');
const labourInspectionRoutes = require('./labourInspectionRoutes');
const labourLicenseRoutes = require('./labourLicenseRoutes');
const statusUpdateRoutes = require('./statusUpdateRoutes');
const blogRoutes = require('./blogRoutes');

const routes = {
  auth: {
    path: '/auth',
    router: authRoutes
  },
  users: {
    path: '/users',
    router: userRoutes
  },
  roles: {
    path: '/roles',
    router: roleRoutes
  },
  companies: {
    path: '/companies',
    router: companyRoutes
  },
  consumers: {
    path: '/consumers',
    router: consumerRoutes
  },
  employeeCompensation: {
    path: '/employee-compensation',
    router: employeeCompensationRoutes
  },
  insuranceCompanies: {
    path: '/insurance-companies',
    router: insuranceCompanyRoutes
  },
  vehiclePolicies: {
    path: '/vehicle-policies',
    router: vehiclePolicyRoutes
  },
  healthPolicies: {
    path: '/health-policies',
    router: healthPolicyRoutes
  },
  firePolicies: {
    path: '/fire-policies',
    router: firePolicyRoutes
  },
  lifePolicies: {
    path: '/life-policies',
    router: lifePolicyRoutes
  },
  dsc: {
    path: '/dsc',
    router: dscRoutes
  },
  renewal: {
    path: '/renewals',
    router: renewalRoutes
  },
  dscLogs: {
    path: '/dsc-logs',
    router: dscLogRoutes
  },
  userRoleWorkLogs: {
    path: '/user-role-logs',
    router: userRoleWorkLogRoutes
  },
  factoryQuotations: {
    path: '/factory-quotations',
    router: factoryQuotationRoutes
  },
  planManagement: {
    path: '/plan-management',
    router: planManagementRoutes
  },
  stabilityManagement: {
    path: '/stability-management',
    router: stabilityManagementRoutes
  },
  applicationManagement: {
    path: '/application-management',
    router: applicationManagementRoutes
  },
  renewalStatus: {
    path: '/renewal-status',
    router: renewalStatusRoutes
  },
  documentDownload: {
    path: '/documents',
    router: documentDownloadRoutes
  },
  labourInspection: {
    path: '/labour-inspection',
    router: labourInspectionRoutes
  },
  labourLicense: {
    path: '/labour-license',
    router: labourLicenseRoutes
  },
  statusUpdate: {
    path: '/status-update',
    router: statusUpdateRoutes
  },
  blogs: {
    path: '/blogs',
    router: blogRoutes
  }
};

/**
 * Register all routes with the Express app
 * @param {Express} app - Express application instance
 */
const registerRoutes = (app) => {
  // Register each route under /api
  Object.values(routes).forEach(({ path, router }) => {
    const fullPath = `/api${path}`;
    app.use(fullPath, router);
    console.log(`Registered routes for: ${fullPath}`);
  });
};

module.exports = {
  routes,
  registerRoutes
}; 