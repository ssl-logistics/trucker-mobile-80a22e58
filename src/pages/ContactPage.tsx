import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Phone, Mail, MapPin, MessageCircle, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ContactPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const contactMethods = [
    {
      icon: Phone,
      label: t('contact.phone'),
      value: '+66 2 330 9312',
      action: 'tel:+6623309312',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      icon: MessageCircle,
      label: t('contact.line'),
      value: '@SSLMarketplace',
      action: 'https://line.me/R/ti/p/@sslmarketplace',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      icon: Mail,
      label: t('contact.email'),
      value: 'support@sslmarketplace.com',
      action: 'mailto:support@sslmarketplace.com',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
  ];

  const handleContact = (action: string) => {
    window.open(action, '_blank');
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground">
        <div className="flex items-center gap-3 px-4 py-3">
          <button 
            onClick={() => navigate('/settings')} 
            className="p-2 hover:bg-header-foreground/10 rounded-lg transition-colors active:scale-95"
            aria-label="Back to settings"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('contact.title')}</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Welcome Message */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {t('contact.welcome')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('contact.welcomeMessage')}
          </p>
        </Card>

        {/* Contact Methods */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground px-1">
            {t('contact.methods')}
          </h3>
          {contactMethods.map((method, index) => (
            <Card
              key={index}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleContact(method.action)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${method.bgColor} flex items-center justify-center`}>
                  <method.icon className={`w-6 h-6 ${method.iconColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{method.label}</p>
                  <p className="font-semibold text-foreground">{method.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Office Information */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground px-1">
            {t('contact.officeInfo')}
          </h3>
          
          <Card className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('contact.address')}</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {t('contact.addressValue')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('contact.hours')}</p>
                <p className="text-sm text-foreground">
                  {t('contact.hoursValue')}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Emergency Contact */}
        <Card className="p-4 bg-red-50 border-red-100">
          <h3 className="font-semibold text-foreground mb-2">
            {t('contact.emergency')}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {t('contact.emergencyMessage')}
          </p>
          <Button
            onClick={() => handleContact('tel:091234567')}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <Phone className="w-4 h-4 mr-2" />
            {t('contact.callNow')}
          </Button>
        </Card>
      </div>
    </div>
  );
}
