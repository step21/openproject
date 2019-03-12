#-- copyright
# OpenProject is a project management system.
# Copyright (C) 2012-2018 the OpenProject Foundation (OPF)
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2017 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See docs/COPYRIGHT.rdoc for more details.
#++

require 'spec_helper'

describe Project::Copy, type: :model do
  describe '#copy' do
    let(:project) { FactoryBot.create(:project_with_types) }
    let(:copy) { Project.new }

    before do
      copy.name = 'foo'
      copy.identifier = 'foo'
      copy.copy(project)
    end

    subject { copy }

    it 'should be able to be copied' do
      expect(copy).to be_valid
      expect(copy).not_to be_new_record
    end
  end

  describe '#copy_attributes' do
    let(:project) { FactoryBot.create(:project_with_types) }

    let(:copy) do
      copy = Project.new
      copy.name = 'foo'
      copy.identifier = 'foo'
      copy
    end

    before do
      copy.send :copy_attributes, project
      copy.save
    end

    describe '#types' do
      subject { copy.types }

      it { is_expected.to eq(project.types) }
    end

    describe '#work_package_custom_fields' do
      let(:project) do
        project = FactoryBot.create(:project_with_types)
        work_package_custom_field = FactoryBot.create(:work_package_custom_field)
        project.work_package_custom_fields << work_package_custom_field
        project.save
        project
      end

      subject { copy.work_package_custom_fields }

      it { is_expected.to eq(project.work_package_custom_fields) }
    end

    describe '#is_public' do
      describe '#non_public' do
        let(:project) do
          project = FactoryBot.create(:project_with_types)
          project.is_public = false
          project.save
          project
        end

        subject { copy.is_public }

        it { expect(copy.is_public?).to eq(project.is_public?) }
      end

      describe '#public' do
        let(:project) do
          project = FactoryBot.create(:project_with_types)
          project.is_public = true
          project.save
          project
        end

        subject { copy.is_public }

        it { expect(copy.is_public?).to eq(project.is_public?) }
      end
    end
  end

  describe '#copy_associations' do
    let(:project) { FactoryBot.create(:project_with_types) }
    let(:copy) do
      copy = Project.new
      copy.name = 'foo'
      copy.identifier = 'foo'
      copy.copy_attributes(project)
      copy.save
      copy
    end

    describe '#copy_work_packages' do
      let(:work_package) { FactoryBot.create(:work_package, project: project) }
      let(:work_package2) { FactoryBot.create(:work_package, project: project) }
      let(:work_package3) { FactoryBot.create(:work_package, project: project) }
      let(:version) { FactoryBot.create(:version, project: project) }
      let(:user) { FactoryBot.create(:admin) }

      before do
        login_as(user)
      end

      describe '#attachments' do
        let!(:attachment) { FactoryBot.create(:attachment, container: work_package) }

        before do
          copy.send :copy_work_packages, project, only
        end

        context 'when requested' do
          let(:only) { [:work_package_attachments] }
          it 'copies them' do
            expect(copy.work_packages.count).to eq(1)

            wp = copy.work_packages.first
            expect(wp.attachments.count).to eq(1)
          end
        end

        context 'when not requested' do
          let(:only) { [] }
          it 'ignores them' do
            expect(copy.work_packages.count).to eq(1)

            wp = copy.work_packages.first
            expect(wp.attachments.count).to eq(0)
          end
        end
      end

      describe '#relation' do
        before do
          FactoryBot.create(:relation, from: work_package, to: work_package2)
          [work_package, work_package2].each { |wp| project.work_packages << wp }

          copy.send :copy_work_packages, project
          copy.save
        end

        it do
          copy.work_packages.each { |wp| expect(wp).to(be_valid) }
          expect(copy.work_packages.count).to eq(project.work_packages.count)
        end
      end

      describe '#parent' do
        before do
          work_package.parent = work_package2
          work_package.save!
          work_package2.parent = work_package3
          work_package2.save!

          copy.send :copy_work_packages, project
          copy.save
        end

        it do
          grandparent_wp_copy = copy.work_packages.find_by(subject: work_package3.subject)
          parent_wp_copy = copy.work_packages.find_by(subject: work_package2.subject)
          child_wp_copy = copy.work_packages.find_by(subject: work_package.subject)

          [grandparent_wp_copy,
           parent_wp_copy,
           child_wp_copy].each do |wp|
            expect(wp).to be_present
          end

          expect(child_wp_copy.parent).to eq(parent_wp_copy)
          expect(parent_wp_copy.parent).to eq(grandparent_wp_copy)
        end
      end

      describe '#category' do
        before do
          wp = work_package
          wp.category = FactoryBot.create(:category, project: project)
          wp.save

          project.work_packages << wp.reload

          copy.send :copy_categories, project
          copy.send :copy_work_packages, project
          copy.save
        end

        it do
          expect(cat = copy.work_packages[0].category).not_to eq(nil)
          expect(cat.project).to eq(copy)
        end
      end

      describe '#watchers' do
        let(:role) { FactoryBot.create(:role, permissions: [:view_work_packages]) }
        let(:watcher) { FactoryBot.create(:user, member_in_project: project, member_through_role: role) }

        describe '#active_watcher' do
          before do
            wp = work_package
            wp.add_watcher watcher
            wp.save

            project.work_packages << wp

            copy.send :copy_members, project
            copy.send :copy_work_packages, project
            copy.save
          end

          it 'does copy active watchers' do
            expect(copy.work_packages[0].watchers.first.user).to eq(watcher)
          end
        end

        describe '#locked_watcher' do
          before do
            user = watcher
            wp = work_package
            wp.add_watcher user
            wp.save

            user.lock!

            project.work_packages << wp

            copy.send :copy_members, project
            copy.send :copy_work_packages, project
            copy.save
          end

          it 'does not copy locked watchers' do
            expect(copy.work_packages[0].watchers).to eq([])
          end
        end
      end
    end

    describe '#copy_queries' do
      let(:query) { FactoryBot.create(:query, project: project) }

      before do
        query

        copy.send(:copy_queries, project)
        copy.save
      end

      subject { copy.queries.count }

      it { is_expected.to eq(project.queries.count) }

      context 'with a filter' do
        let(:query) {
          query = FactoryBot.build(:query, project: project)
          query.add_filter('subject', '~', ['bogus'])
          query.save!
        }

        subject { copy.queries }

        it 'produces a valid query in the new project' do
          expect(subject.all?(&:valid?)).to eq(true)
          expect(subject.count).to eq(1)
        end
      end

      context 'with a query menu item' do
        let(:query) {
          query = FactoryBot.build(:query, project: project)
          query.add_filter('subject', '~', ['bogus'])
          query.save!

          MenuItems::QueryMenuItem.create(
            navigatable_id: query.id,
            name: 'some-uuid',
            title: 'My query title'
          )

          query
        }
        subject { copy.queries.first}

        it 'copies the menu item' do
          expect(subject).to be_valid
          expect(subject.query_menu_item.title).to eq('My query title')
        end
      end
    end

    describe '#copy_members' do
      describe '#with_user' do
        before do
          role = FactoryBot.create(:role)
          user = FactoryBot.create(:user, member_in_project: project, member_through_role: role)

          copy.send(:copy_members, project)
          copy.save
        end

        subject { copy.members.count }

        it { is_expected.to eq(project.members.count) }
      end

      describe '#with_group' do
        before do
          project.add_member! FactoryBot.create(:group), FactoryBot.create(:role)

          copy.send(:copy_members, project)
          copy.save
        end

        subject { copy.principals.count }

        it { is_expected.to eq(project.principals.count) }
      end
    end

    describe '#copy_wiki' do
      before do
        project.wiki = FactoryBot.create(:wiki, project: project)
        project.save

        copy.send(:copy_wiki, project)
        copy.save
      end

      subject { copy.wiki }

      it { is_expected.not_to eq(nil) }
      it { is_expected.to be_valid }

      describe '#copy_wiki_pages' do
        describe '#dont_copy_wiki_page_without_content' do
          before do
            project.wiki.pages << FactoryBot.create(:wiki_page)

            copy.send(:copy_wiki_pages, project)
            copy.save
          end

          subject { copy.wiki.pages.count }

          it { is_expected.to eq(0) }
        end

        describe '#copy_wiki_page_with_content' do
          before do
            project.wiki.pages << FactoryBot.create(:wiki_page_with_content)

            copy.send(:copy_wiki_pages, project)
            copy.save
          end

          subject { copy.wiki.pages.count }

          it { is_expected.to eq(project.wiki.pages.count) }
        end
      end
      describe '#copy_wiki_menu_items' do
        before do
          project.wiki.wiki_menu_items << FactoryBot.create(:wiki_menu_item_with_parent, wiki: project.wiki)
          copy.send(:copy_wiki_menu_items, project)
          copy.save
        end

        subject { copy.wiki.wiki_menu_items.count }

        it { is_expected.to eq(project.wiki.wiki_menu_items.count) }
      end
    end

    describe '#copy_boards' do
      let(:board) { FactoryBot.create(:board, project: project) }

      context 'boards are copied' do
        before do
          copy.send(:copy_boards, project)
          copy.save
        end

        subject { copy.boards.count }

        it { is_expected.to eq(project.forums.count) }
      end

      context 'board topics are copied' do
        before do
          topic = FactoryBot.create(:message, forum: board)
          message = FactoryBot.create(:message, forum: board, parent_id: topic.id)

          copy.send(:copy_boards, project)
          copy.save
        end

        it 'should copy topics without replies' do
          expect(copy.boards.first.topics.count).to eq(project.forums.first.topics.count)
          expect(copy.boards.first.messages.count).not_to eq(project.forums.first.messages.count)
        end
      end
    end

    describe '#copy_versions' do
      before do
        FactoryBot.create(:version, project: project)

        copy.send(:copy_versions, project)
        copy.save
      end

      subject { copy.versions.count }

      it { is_expected.to eq(project.versions.count) }
    end

    describe '#copy_categories' do
      before do
        FactoryBot.create(:category, project: project)

        copy.send(:copy_categories, project)
        copy.save
      end

      subject { copy.categories.count }

      it { is_expected.to eq(project.categories.count) }
    end
  end
end
