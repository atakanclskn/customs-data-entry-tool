
import React from 'react';
import { NavigateFunction, Theme } from '../types';

interface AboutPageProps {
  navigate: NavigateFunction;
  theme: Theme;
}

const AboutPage: React.FC<AboutPageProps> = ({ navigate, theme }) => {
  return (
    <div className="w-full">
        <div className="flex items-center mb-8">
            <h1 className="text-3xl font-bold text-text-primary">Hakkında</h1>
        </div>

        <div className="max-w-3xl mx-auto modern-card rounded-2xl p-8 space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-text-primary">Gümrük Veri Giriş Aracı</h2>
            </div>
            
            <p className="text-text-secondary leading-relaxed">
                Bu uygulama, gümrük beyannamesi ve navlun faturası gibi lojistik dokümanları için veri girişini kolaylaştırmak üzere tasarlanmıştır. 
                Kullanıcılar, doküman görsellerini (PDF veya resim formatında) yükleyebilir, bunları "Beyanname" veya "Navlun Faturası" olarak sınıflandırabilir ve 
                ilgili bilgileri tam ekran bir düzenleyiciyle manuel olarak girebilirler.
            </p>

            <div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">Ana Teknolojiler</h3>
                <ul className="list-disc list-inside space-y-2 text-text-secondary">
                    <li>
                        <span className="font-semibold text-text-primary">React:</span> Kullanıcı arayüzü için modern ve reaktif bir yapı sağlar.
                    </li>
                     <li>
                        <span className="font-semibold text-text-primary">TailwindCSS:</span> Hızlı ve modern bir şekilde şık ve duyarlı tasarımlar oluşturmayı sağlar.
                    </li>
                     <li>
                        <span className="font-semibold text-text-primary">IndexedDB:</span> Tüm verilerin güvenli bir şekilde kullanıcının tarayıcısında saklanmasını sağlar, bu sayede uygulama çevrimdışı da çalışabilir.
                    </li>
                </ul>
            </div>

            <p className="text-text-secondary leading-relaxed pt-4 border-t border-border">
                Uygulama, operasyonel verimliliği artırmayı, manuel veri girişini hızlandırmayı ve lojistik doküman verilerini dijital olarak organize etmeyi hedefler.
            </p>
        </div>
    </div>
  );
};

export default AboutPage;