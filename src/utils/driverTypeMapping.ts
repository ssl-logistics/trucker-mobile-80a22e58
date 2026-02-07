/**
 * Maps the userType from AuthContext to the driver_type expected by the update-freelance-driver API
 * 
 * userType values: 'freelance_driver', 'internal_driver', 'external_driver'
 * driver_type values: 'freelance', 'internal', 'external'
 */
export function getDriverTypeFromUserType(userType: string): 'freelance' | 'internal' | 'external' {
  switch (userType) {
    case 'internal_driver':
      return 'internal';
    case 'external_driver':
      return 'external';
    case 'freelance_driver':
    default:
      return 'freelance';
  }
}
