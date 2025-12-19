import { Card } from "@/components/ui/card";
import { Mail, User, Code } from "lucide-react";

export default function Contact() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Contact Us</h1>
        <p className="text-muted-foreground">Get in touch with the developer</p>
      </div>

      <Card className="p-8">
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Developer</h3>
              <p className="text-foreground text-xl font-medium">MUAD HAJI</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Email Address</h3>
              <a href="mailto:schoolfeesystem@gmail.com" className="text-primary hover:underline text-lg">
                schoolfeesystem@gmail.com
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Code className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">About This Software</h3>
              <p className="text-muted-foreground leading-relaxed">
                This School Fee Management Software is designed to help schools manage student fees, 
                payments, and analytics efficiently. The system provides comprehensive tools for tracking 
                student information, recording payments, generating reports, and monitoring fee collection 
                with an intuitive and easy-to-use interface.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Contact the developer for support, feature requests, custom modifications, or any inquiries 
                about the software.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
