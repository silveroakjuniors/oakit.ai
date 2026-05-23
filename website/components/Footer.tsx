import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#fafafa] border-t border-gray-100 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1B4332] to-[#40916c] flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-bold text-[#1B4332]">oakit.ai</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              AI-powered school management for preschools and primary schools. Rooted fearlessly.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Product</p>
            <ul className="space-y-2.5">
              <li><a href="#features" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">Pricing</a></li>
              <li><a href="#how-it-works" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">How it Works</a></li>
              <li><a href="#faq" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Company</p>
            <ul className="space-y-2.5">
              <li><a href="mailto:hello@oakit.ai" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">Contact</a></li>
              <li><Link href="/privacy" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">Terms of Service</Link></li>
              <li><Link href="/cookie" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Get in touch</p>
            <ul className="space-y-2.5">
              <li><a href="mailto:hello@oakit.ai" className="text-sm text-gray-600 hover:text-[#1B4332] transition-colors">hello@oakit.ai</a></li>
              <li><span className="text-sm text-gray-600">Hyderabad, India</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Oakit.ai. All rights reserved.</p>
          <p className="text-xs text-gray-400">Made with care for schools that shape the future.</p>
        </div>
      </div>
    </footer>
  );
}
