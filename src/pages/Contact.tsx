import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import appIcon from "@/assets/app-icon.png";

const CONTACT_EMAIL = "schoolfeesystem@gmail.com";
const CONTACT_WHATSAPP = "+255 123 456 789";
const CONTACT_PHONE = "+255 123 456 789";
const CONTACT_ADDRESS = "123 Education Street, Dar es Salaam, Tanzania";

const Contact = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img src={appIcon} alt="School Fee System" className="h-12 w-12 object-contain" />
        <div>
          <h1 className="text-2xl font-bold">Contact Us</h1>
          <p className="text-muted-foreground">Get in touch with our support team</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              WhatsApp
            </CardTitle>
            <CardDescription>Quick support via WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href={`https://wa.me/${CONTACT_WHATSAPP.replace(/[^0-9+]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {CONTACT_WHATSAPP}
            </a>
            <p className="text-sm text-muted-foreground mt-2">
              Available Monday - Friday, 8:00 AM - 6:00 PM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Email
            </CardTitle>
            <CardDescription>Send us an email anytime</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline font-medium"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="text-sm text-muted-foreground mt-2">
              We typically respond within 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-500" />
              Phone
            </CardTitle>
            <CardDescription>Call us directly</CardDescription>
          </CardHeader>
          <CardContent>
            <a 
              href={`tel:${CONTACT_PHONE.replace(/[^0-9+]/g, '')}`}
              className="text-primary hover:underline font-medium"
            >
              {CONTACT_PHONE}
            </a>
            <p className="text-sm text-muted-foreground mt-2">
              Available during business hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500" />
              Office Address
            </CardTitle>
            <CardDescription>Visit our office</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{CONTACT_ADDRESS}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Open Monday - Friday, 9:00 AM - 5:00 PM
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contact;
