import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Calendar,
  Users,
  MapPin,
  Upload,
  Save,
  X,
  Clock,
  DollarSign,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TournamentFormData {
  name: string;
  description: string;
  format: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  location: string;
  minTeams: string;
  maxTeams: string;
  category: string;
  gameType: string;
  rules: string;
  prizePool: {
    firstPlace: string;
    secondPlace: string;
    thirdPlace: string;
  };
  logoFile: File | null;
  bannerFile: File | null;
}

const TournamentCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<TournamentFormData>({
    name: '',
    description: '',
    format: 'single_elimination',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    location: '',
    minTeams: '4',
    maxTeams: '16',
    category: 'mens',
    gameType: 'T20',
    rules: '',
    prizePool: {
      firstPlace: '',
      secondPlace: '',
      thirdPlace: ''
    },
    logoFile: null,
    bannerFile: null
  });

  const handleFileUpload = async (file: File, type: 'logo' | 'banner') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `tournament-${type}s/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(`tournament-${type}s`)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(`tournament-${type}s`)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let logoUrl = '';
      let bannerUrl = '';

      if (formData.logoFile) {
        logoUrl = await handleFileUpload(formData.logoFile, 'logo');
      }

      if (formData.bannerFile) {
        bannerUrl = await handleFileUpload(formData.bannerFile, 'banner');
      }

      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: formData.name,
          description: formData.description,
          format: formData.format,
          start_date: formData.startDate,
          end_date: formData.endDate,
          registration_deadline: formData.registrationDeadline,
          location: formData.location,
          min_teams: parseInt(formData.minTeams),
          max_teams: parseInt(formData.maxTeams),
          category: formData.category,
          game_type: formData.gameType,
          rules: { rules: formData.rules },
          prize_pool: {
            first_place: formData.prizePool.firstPlace,
            second_place: formData.prizePool.secondPlace,
            third_place: formData.prizePool.thirdPlace
          },
          logo_url: logoUrl,
          banner_url: bannerUrl,
          status: 'upcoming'
        })
        .select()
        .single();

      if (error) throw error;

      setMessage({ type: 'success', text: 'Tournament created successfully' });
      navigate(`/tournaments/${data.id}`);
    } catch (error) {
      console.error('Error creating tournament:', error);
      setMessage({ type: 'error', text: 'Failed to create tournament' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Tournament</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-md ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tournament Name</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Trophy className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Premier Cricket League 2025"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Format</label>
              <div className="mt-1">
                <select
                  required
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                >
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="league">League</option>
                  <option value="group_stage_knockout">Group Stage + Knockout</option>
                </select>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tournament description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Registration Deadline</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  required
                  value={formData.registrationDeadline}
                  onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Mumbai, India"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Minimum Teams</label>
              <input
                type="number"
                required
                min="2"
                value={formData.minTeams}
                onChange={(e) => setFormData({ ...formData, minTeams: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Maximum Teams</label>
              <input
                type="number"
                required
                min={formData.minTeams}
                value={formData.maxTeams}
                onChange={(e) => setFormData({ ...formData, maxTeams: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="mens">Men's</option>
                <option value="womens">Women's</option>
                <option value="under19">Under-19</option>
                <option value="under16">Under-16</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Game Type</label>
              <select
                required
                value={formData.gameType}
                onChange={(e) => setFormData({ ...formData, gameType: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="T20">T20</option>
                <option value="ODI">ODI</option>
                <option value="Test">Test</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Tournament Rules</label>
              <textarea
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter tournament rules and regulations..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Prize Pool</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500">First Place</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.prizePool.firstPlace}
                      onChange={(e) => setFormData({
                        ...formData,
                        prizePool: { ...formData.prizePool, firstPlace: e.target.value }
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Amount"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Second Place</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.prizePool.secondPlace}
                      onChange={(e) => setFormData({
                        ...formData,
                        prizePool: { ...formData.prizePool, secondPlace: e.target.value }
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Amount"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Third Place</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.prizePool.thirdPlace}
                      onChange={(e) => setFormData({
                        ...formData,
                        prizePool: { ...formData.prizePool, thirdPlace: e.target.value }
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Amount"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tournament Logo</label>
              <div className="mt-1 flex items-center space-x-4">
                {formData.logoFile && (
                  <div className="relative w-24 h-24">
                    <img
                      src={URL.createObjectURL(formData.logoFile)}
                      alt="Logo preview"
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoFile: null })}
                      className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <span className="flex items-center">
                    <Upload className="h-5 w-5 mr-2" />
                    {formData.logoFile ? 'Change Logo' : 'Upload Logo'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormData({ ...formData, logoFile: file });
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tournament Banner</label>
              <div className="mt-1 flex items-center space-x-4">
                {formData.bannerFile && (
                  <div className="relative w-40 h-24">
                    <img
                      src={URL.createObjectURL(formData.bannerFile)}
                      alt="Banner preview"
                      className="w-40 h-24 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, bannerFile: null })}
                      className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <span className="flex items-center">
                    <Upload className="h-5 w-5 mr-2" />
                    {formData.bannerFile ? 'Change Banner' : 'Upload Banner'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormData({ ...formData, bannerFile: file });
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={() => navigate('/tournaments')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              <Save className="w-5 h-5 mr-2" />
              Create Tournament
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TournamentCreate;