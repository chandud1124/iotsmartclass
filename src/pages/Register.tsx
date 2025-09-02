import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Eye, EyeOff, ArrowLeft, Upload, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { authAPI } from '@/services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';

const departments = [
  'Information Technology',
  'Electrical Engineering',
  'Business Administration',
  'Management Studies',
  'Security',
  'Maintenance',
  'Administration',
  'Library',
  'Sports',
  'Other'
];

const roles = [
  {
    value: 'admin',
    label: 'Administrator',
    description: 'Full system access, user management, and approval permissions',
    permissions: { canRequestExtensions: true, canApproveExtensions: true, canManageUsers: true, canViewReports: true }
  },
  {
    value: 'principal',
    label: 'Principal',
    description: 'School-wide oversight and approval permissions',
    permissions: { canRequestExtensions: true, canApproveExtensions: true, canManageUsers: false, canViewReports: true }
  },
  {
    value: 'dean',
    label: 'Dean',
    description: 'Faculty oversight and departmental approval permissions',
    permissions: { canRequestExtensions: true, canApproveExtensions: true, canManageUsers: false, canViewReports: true }
  },
  {
    value: 'hod',
    label: 'Head of Department',
    description: 'Department oversight and approval permissions',
    permissions: { canRequestExtensions: true, canApproveExtensions: true, canManageUsers: false, canViewReports: false }
  },
  {
    value: 'faculty',
    label: 'Faculty/Teacher',
    description: 'Can control devices and request class extensions',
    permissions: { canRequestExtensions: true, canApproveExtensions: false, canManageUsers: false, canViewReports: false }
  },
  {
    value: 'security',
    label: 'Security Personnel',
    description: 'Security monitoring and access control',
    permissions: { canRequestExtensions: false, canApproveExtensions: false, canManageUsers: false, canViewReports: false }
  },
  {
    value: 'student',
    label: 'Student',
    description: 'Access to basic classroom devices and schedules',
    permissions: { canRequestExtensions: false, canApproveExtensions: false, canManageUsers: false, canViewReports: false }
  },
  {
    value: 'user',
    label: 'General Staff',
    description: 'Limited access to system features',
    permissions: { canRequestExtensions: false, canApproveExtensions: false, canManageUsers: false, canViewReports: false }
  }
];

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
    employeeId: '',
    designation: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password strength calculation with detailed feedback
  const calculatePasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;
    const strength = (score / 5) * 100;

    return {
      score: strength,
      checks,
      label: strength === 100 ? 'Very Strong' :
        strength >= 80 ? 'Strong' :
          strength >= 60 ? 'Good' :
            strength >= 40 ? 'Fair' : 'Weak'
    };
  };

  const passwordStrength = calculatePasswordStrength(form.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic Information
        if (!form.name.trim()) newErrors.name = 'Full name is required';
        if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = 'Valid email is required';
        if (!form.role) newErrors.role = 'Please select your role';
        if (!form.department) newErrors.department = 'Please select your department';
        break;

      case 2: // Account Security
        if (form.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        if (passwordStrength.score < 60) newErrors.password = 'Password is too weak';
        if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        break;

      case 3: // Professional Details
        if (form.role !== 'student' && !form.employeeId.trim()) newErrors.employeeId = 'Employee ID is required';
        if (form.role !== 'student' && !form.designation.trim()) newErrors.designation = 'Designation is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      // Prepare user data object (no longer using FormData since we removed file uploads)
      const userData = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        department: form.department,
        employeeId: form.employeeId || undefined,
        designation: form.designation || undefined
      };

      const response = await authAPI.register(userData);

      if (!response.data?.success) {
        toast({
          title: 'Registration Failed',
          description: response.data?.message || 'Registration failed. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Registration Successful',
        description: "Your account registration has been submitted and is pending admin approval. You'll receive an email notification once reviewed.",
        duration: 8000
      });

      setTimeout(() => navigate('/login'), 5000);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to connect to the server. Please try again.',
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
            currentStep >= step
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}>
            {currentStep > step ? <CheckCircle className="w-4 h-4" /> : step}
          </div>
          {step < 3 && (
            <div className={cn(
              "w-12 h-0.5 mx-2",
              currentStep > step ? "bg-primary" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john.doe@university.edu"
                value={form.email}
                onChange={handleChange}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select name="role" value={form.role} onValueChange={(value) => setForm(prev => ({ ...prev, role: value }))}>
                <SelectTrigger className={cn("w-full", errors.role ? 'border-red-500' : '')}>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent className="w-full min-w-[var(--radix-select-trigger-width)]">
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value} className="cursor-pointer">
                      <div className="flex flex-col items-start py-1">
                        <div className="font-medium text-left w-full">{role.label}</div>
                        <div className="text-sm text-muted-foreground text-left w-full">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select name="department" value={form.department} onValueChange={(value) => setForm(prev => ({ ...prev, department: value }))}>
                <SelectTrigger className={errors.department ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select your department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && <p className="text-sm text-red-500">{errors.department}</p>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={handleChange}
                  className={errors.password ? 'border-red-500' : ''}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Progress value={passwordStrength.score} className="h-2" />
              <div className="text-xs text-muted-foreground">
                <p>Password strength: <span className={cn(
                  passwordStrength.score >= 80 ? 'text-green-600' :
                    passwordStrength.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                )}>{passwordStrength.label}</span></p>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <div className={cn("flex items-center gap-1", passwordStrength.checks.length ? 'text-green-600' : 'text-muted-foreground')}>
                    {passwordStrength.checks.length ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span className="text-xs">8+ characters</span>
                  </div>
                  <div className={cn("flex items-center gap-1", passwordStrength.checks.uppercase ? 'text-green-600' : 'text-muted-foreground')}>
                    {passwordStrength.checks.uppercase ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span className="text-xs">Uppercase</span>
                  </div>
                  <div className={cn("flex items-center gap-1", passwordStrength.checks.lowercase ? 'text-green-600' : 'text-muted-foreground')}>
                    {passwordStrength.checks.lowercase ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span className="text-xs">Lowercase</span>
                  </div>
                  <div className={cn("flex items-center gap-1", passwordStrength.checks.number ? 'text-green-600' : 'text-muted-foreground')}>
                    {passwordStrength.checks.number ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span className="text-xs">Number</span>
                  </div>
                  <div className={cn("flex items-center gap-1", passwordStrength.checks.special ? 'text-green-600' : 'text-muted-foreground')}>
                    {passwordStrength.checks.special ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span className="text-xs">Special char</span>
                  </div>
                </div>
              </div>
              {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className={errors.confirmPassword ? 'border-red-500' : ''}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            {form.role !== 'student' && (
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input
                  id="employeeId"
                  name="employeeId"
                  placeholder="EMP001"
                  value={form.employeeId}
                  onChange={handleChange}
                  className={errors.employeeId ? 'border-red-500' : ''}
                />
                {errors.employeeId && <p className="text-sm text-red-500">{errors.employeeId}</p>}
              </div>
            )}

            {form.role !== 'student' && (
              <div className="space-y-2">
                <Label htmlFor="designation">Designation *</Label>
                <Input
                  id="designation"
                  name="designation"
                  placeholder="Assistant Professor"
                  value={form.designation}
                  onChange={handleChange}
                  className={errors.designation ? 'border-red-500' : ''}
                />
                {errors.designation && <p className="text-sm text-red-500">{errors.designation}</p>}
              </div>
            )}

            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your registration will be reviewed by an administrator. You will receive an email notification once your account is approved.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>Step {currentStep} of 3 - Join the IoT Classroom Management System</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {renderStepIndicator()}
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderStepContent()}
          </form>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            Previous
          </Button>

          {currentStep < 3 ? (
            <Button type="button" onClick={nextStep}>
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              className="min-w-[120px]"
            >
              {loading ? 'Submitting...' : 'Submit Registration'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default Register;
