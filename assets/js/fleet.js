'use strict';

$(function () {

    // ================================================================
    // Dark theme toggle
    // ================================================================
    function applyTheme(dark) {
        $('html').attr('data-theme', dark ? 'dark' : null);
        $('#themeToggle .icon-sun').toggle(!dark);
        $('#themeToggle .icon-moon').toggle(dark);
    }

    applyTheme(localStorage.getItem('fleet_theme') === 'dark');

    $('#themeToggle').on('click', function () {
        var isDark = $('html').attr('data-theme') === 'dark';
        localStorage.setItem('fleet_theme', isDark ? 'light' : 'dark');
        applyTheme(!isDark);
    });

    // ================================================================
    // Sidebar collapse
    // ================================================================
    var $sidebar   = $('#fleetSidebar');
    var $toggleBtn = $('#fleetSidebarToggle');
    var $overlay   = $('#fleetOverlay');

    $toggleBtn.on('click', function () {
        if ($(window).width() <= 768) {
            $sidebar.toggleClass('mobile-open');
            $overlay.toggleClass('show');
        } else {
            $sidebar.toggleClass('collapsed');
            try {
                document.cookie = 'fleet_sidebar=' +
                    ($sidebar.hasClass('collapsed') ? 'c' : 'o') +
                    '; path=/; max-age=31536000';
            } catch (e) {}
        }
    });

    $overlay.on('click', function () {
        $sidebar.removeClass('mobile-open');
        $overlay.removeClass('show');
    });

    // ================================================================
    // Expandable nav items
    // ================================================================
    $(document).on('click', '.nav-link[data-expand]', function (e) {
        e.preventDefault();
        $(this).closest('.nav-item').toggleClass('open');
    });

    // ================================================================
    // Password toggle
    // ================================================================
    $(document).on('click', '.pw-toggle', function () {
        var $input  = $(this).closest('.pw-wrapper').find('input');
        var isPassword = $input.attr('type') === 'password';
        $input.attr('type', isPassword ? 'text' : 'password');
        $(this).find('.eye-on').toggle(!isPassword);
        $(this).find('.eye-off').toggle(isPassword);
    });

    // ================================================================
    // Auto-dismiss alerts
    // ================================================================
    $('[data-auto-dismiss]').each(function () {
        var $el    = $(this);
        var delay  = parseInt($el.data('auto-dismiss'), 10) || 4000;
        setTimeout(function () {
            $el.fadeTo(400, 0, function () { $el.remove(); });
        }, delay);
    });

    // ================================================================
    // Alert close button
    // ================================================================
    $(document).on('click', '.alert-close', function () {
        $(this).closest('.fleet-alert').fadeTo(300, 0, function () { $(this).remove(); });
    });

    // ================================================================
    // Modals
    // ================================================================
    function openModal(id) {
        var $backdrop = $(id);
        if (!$backdrop.length) return;
        $('body').css('overflow', 'hidden');
        $backdrop.addClass('show').trigger('fleet:modal:open');
    }

    function closeModal($backdrop) {
        if (!$backdrop || !$backdrop.length) return;
        $backdrop.removeClass('show').trigger('fleet:modal:close');
        $('body').css('overflow', '');
    }

    $(document).on('click', '[data-modal-open]', function (e) {
        e.preventDefault();
        openModal($(this).data('modal-open'));
    });

    $(document).on('click', '[data-modal-close], .fleet-modal-close', function () {
        closeModal($(this).closest('.fleet-modal-backdrop'));
    });

    $(document).on('click', '.fleet-modal-backdrop', function (e) {
        if ($(e.target).hasClass('fleet-modal-backdrop')) {
            closeModal($(e.target));
        }
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape') {
            closeModal($('.fleet-modal-backdrop.show').first());
        }
    });

    window.fleetModal = { open: openModal, close: closeModal };

    // ================================================================
    // Drawers (side panel)
    // ================================================================
    function openDrawer(id) {
        var $backdrop = $(id);
        if (!$backdrop.length) return;
        $('body').css('overflow', 'hidden');
        $backdrop.addClass('show');
    }

    function closeDrawer($backdrop) {
        if (!$backdrop || !$backdrop.length) return;
        $backdrop.removeClass('show');
        $('body').css('overflow', '');
    }

    $(document).on('click', '[data-drawer-open]', function (e) {
        e.preventDefault();
        openDrawer($(this).data('drawer-open'));
    });

    $(document).on('click', '[data-drawer-close]', function () {
        closeDrawer($(this).closest('.fleet-drawer-backdrop'));
    });

    $(document).on('click', '.fleet-drawer-backdrop', function (e) {
        if ($(e.target).hasClass('fleet-drawer-backdrop')) {
            closeDrawer($(e.target));
        }
    });

    window.fleetDrawer = { open: openDrawer, close: closeDrawer };

    // ================================================================
    // Dropdowns
    // ================================================================
    function closeAllDropdowns($except) {
        $('.fleet-dropdown-menu.show').not($except || $()).removeClass('show');
    }

    $(document).on('click', '[data-dropdown-toggle]', function () {
        var $menu   = $($(this).data('dropdown-toggle'));
        var wasOpen = $menu.hasClass('show');
        closeAllDropdowns();
        if (!wasOpen) $menu.addClass('show');
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('[data-dropdown-toggle], .fleet-dropdown-menu').length) {
            closeAllDropdowns();
        }
    });

    // ================================================================
    // Tabs
    // ================================================================
    $(document).on('click', '.fleet-tab[data-tab-target]', function (e) {
        e.preventDefault();
        var $tab      = $(this);
        var $tabsList = $tab.closest('.fleet-tabs-list');
        var $tabsWrap = $tab.closest('.fleet-tabs');

        if (!$tabsList.length) return;

        $tabsList.find('.fleet-tab').removeClass('active');
        $tab.addClass('active');

        if ($tabsWrap.length) {
            $tabsWrap.find('.fleet-tab-pane').removeClass('active');
            $tabsWrap.find($tab.data('tab-target')).addClass('active');
        }

        $tab.trigger('fleet:tab:change', [{ target: $tab.data('tab-target') }]);
    });

    // ================================================================
    // Toggle switch labels
    // ================================================================
    $(document).on('click', '.fleet-toggle', function (e) {
        if ($(e.target).is('input')) return;
        var $input = $(this).find('input[type="checkbox"]');
        if ($input.length && !$input.prop('disabled')) {
            $input.prop('checked', !$input.prop('checked')).trigger('change');
        }
    });

    // ================================================================
    // Chip remove
    // ================================================================
    $(document).on('click', '.chip-remove', function () {
        $(this).closest('.fleet-chip').fadeTo(200, 0, function () { $(this).remove(); });
    });

    // ================================================================
    // Expandable table rows (data-expand-row)
    // ================================================================
    $(document).on('click', '.expand-btn[data-expand-row]', function () {
        var $row   = $('#' + $(this).data('expand-row'));
        var isOpen = $row.is(':visible');
        $row.toggle(!isOpen);
        $(this).toggleClass('open', !isOpen);
    });

    // ================================================================
    // Confirm dialog helper
    // ================================================================
    $(document).on('click', '[data-confirm]', function (e) {
        if (!window.confirm($(this).data('confirm'))) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    });

});
